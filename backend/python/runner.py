import ast
import io
import math
import os
import re
import sys
import traceback
from contextlib import redirect_stdout, redirect_stderr

import cadquery as cq

_mechagen_cq_union_cut_patched = False


def _patch_cq_union_cut_chain() -> None:
    """
    Workplane.union/cut only accept one solid per call in CadQuery 2.x, but models emit
    base.union(t1, t2, …) or base.union(*teeth). Patch the class so many args chain.
    """
    global _mechagen_cq_union_cut_patched
    if _mechagen_cq_union_cut_patched:
        return
    Wp = cq.Workplane
    _orig_union = Wp.union
    _orig_cut = Wp.cut

    def _local_solids_count(wp) -> int:
        """Solids on *this* workplane stack only (not parent chain)."""
        try:
            return len(list(wp.solids()))
        except Exception:
            return 0

    def _solid_from(obj):
        """Best-effort solid extractor from Workplane/Shape-like values."""
        if obj is None:
            return None
        try:
            from cadquery.occ_impl.shapes import Shape

            if isinstance(obj, Shape):
                return obj
        except Exception:
            pass
        try:
            return obj.findSolid()
        except Exception:
            return None

    def _wp_from_solid(solid):
        """Create a workplane with `solid` on the local stack."""
        try:
            return cq.Workplane("XY").newObject([solid])
        except Exception:
            return cq.Workplane().add(solid)

    def _wp_needs_adopt_other_only(wp) -> bool:
        """
        True when there is nothing on the local stack to union from (empty / wire-only)
        and no parent solid to re-stack — then we adopt `other` as the new base.
        If findSolid() succeeds (e.g. after .faces().workplane()), _union_one re-wraps
        that solid onto a fresh Workplane so native union can run.
        """
        if _local_solids_count(wp) > 0:
            return False
        return _solid_from(wp) is None

    def _other_has_fusible_geometry(other) -> bool:
        if other is None:
            return False
        try:
            if _local_solids_count(other) > 0:
                return True
        except Exception:
            pass
        return _solid_from(other) is not None

    def _null_shape_retryable(exc: BaseException) -> bool:
        s = str(exc).lower()
        return "null" in s and "topo" in s

    def _union_one(self, other, kwargs):
        """
        Single .union(other). OCCT often returns Null TopoDS_Shape on gear teeth
        (coincident faces, many chained fuses). Retry with glue + tolerance.
        """
        # CadQuery's union() requires a solid on *this* workplane's stack. After
        # .faces(...).workplane(), solids() is often empty while findSolid() still
        # resolves the parent solid — native union then raises. Re-stack the solid.
        base_wp = self
        base_solid = _solid_from(self)
        if _local_solids_count(self) == 0 and base_solid is not None:
            base_wp = _wp_from_solid(base_solid)

        base_kw = dict(kwargs)
        attempts = [
            base_kw,
            {**base_kw, "glue": True, "tol": base_kw.get("tol") or 1e-3},
            {**base_kw, "glue": True, "tol": max(base_kw.get("tol") or 1e-3, 5e-3), "clean": False},
        ]
        last = None  # type: ignore[assignment]
        for kw in attempts:
            try:
                return _orig_union(base_wp, other, **kw)
            except ValueError as e:
                last = e
                if "at least one solid" in str(e):
                    s_base = _solid_from(base_wp) or base_solid
                    s_other = _solid_from(other)
                    if s_base is not None and s_other is not None:
                        try:
                            fused = s_base.fuse(
                                s_other,
                                glue=kw.get("glue", False),
                                tol=kw.get("tol", None),
                            )
                            return _wp_from_solid(fused)
                        except Exception:
                            pass
                    if _wp_needs_adopt_other_only(self) and _other_has_fusible_geometry(
                        other
                    ):
                        return other
                    raise
                if not _null_shape_retryable(e):
                    raise
            except Exception as e:
                last = e
                if not _null_shape_retryable(e):
                    raise
        assert last is not None
        raise last

    def union(self, *args, **kwargs):
        # LLMs often do: gear = cq.Workplane("XY"); gear = gear.union(tooth)
        # or gear = cq.Workplane("XY").circle(r); gear = gear.union(tooth)
        # Both fail: no *solid* on the stack. Catch and adopt the other operand.
        if len(args) == 0:
            return _orig_union(self, **kwargs)
        if len(args) == 1:
            other = args[0]
            if _wp_needs_adopt_other_only(self) and _other_has_fusible_geometry(other):
                return other
            try:
                return _union_one(self, other, kwargs)
            except ValueError as e:
                if (
                    "at least one solid" in str(e)
                    and _wp_needs_adopt_other_only(self)
                    and _other_has_fusible_geometry(other)
                ):
                    return other
                raise
        # Multi-arg path
        try:
            out = _union_one(self, args[0], kwargs)
        except ValueError as e:
            if (
                "at least one solid" in str(e)
                and _wp_needs_adopt_other_only(self)
                and _other_has_fusible_geometry(args[0])
            ):
                out = args[0]
            else:
                raise
        for solid in args[1:]:
            out = out.union(solid)
        return out

    def cut(self, *args, **kwargs):
        if len(args) <= 1:
            return _orig_cut(self, *args, **kwargs)
        out = _orig_cut(self, args[0], **kwargs)
        for solid in args[1:]:
            out = out.cut(solid)
        return out

    Wp.union = union  # type: ignore[method-assign]
    Wp.cut = cut  # type: ignore[method-assign]
    _mechagen_cq_union_cut_patched = True


def _matching_close_paren(src: str, open_idx: int) -> int:
    """Return index of ')' matching '(' at open_idx, or -1. Skips string literals."""
    if open_idx >= len(src) or src[open_idx] != "(":
        return -1
    depth = 1
    i = open_idx + 1
    n = len(src)
    while i < n:
        c = src[i]
        if c in ('"', "'"):
            quote = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def _strip_cq_finish_ops(code: str) -> str:
    """
    Remove .edges().fillet(...), .edges().chamfer(...), then .fillet(...) / .chamfer(...)
    method calls (e.g. result.fillet(...)). Used when MECHAGEN_STRIP_FINISH_OPS is set for
    ball-bearing prompts where models add finish ops and OCCT fails.
    """
    max_iter = 400
    for _ in range(max_iter):
        m = re.search(r"\.edges\(\)\s*\.\s*(?:fillet|chamfer)\s*\(", code)
        if not m:
            break
        start = m.start()
        paren = m.end() - 1
        end = _matching_close_paren(code, paren)
        if end < 0:
            break
        code = code[:start] + code[end + 1 :]
    for meth in ("fillet", "chamfer"):
        needle = f".{meth}("
        for _ in range(max_iter):
            changed = False
            pos = 0
            while True:
                j = code.find(needle, pos)
                if j < 0:
                    break
                if j == 0:
                    pos = j + 1
                    continue
                prev = code[j - 1]
                if prev == "." or not (prev.isalnum() or prev in "_)]}"):
                    pos = j + 1
                    continue
                paren = j + len(needle) - 1
                end = _matching_close_paren(code, paren)
                if end >= 0:
                    code = code[:j] + code[end + 1 :]
                    changed = True
                    break
                pos = j + 1
            if not changed:
                break
    return code


def _fix_selector_string_typos(code: str) -> str:
    """
    LLMs often emit faces(\">(Z,0,0)\") or edges(\"|(Z)\"); CadQuery's string selector grammar
    requires numeric tuple components. Map common axis-letter mistakes to unit vectors.
    """
    pairs = (
        (">(Z,0,0)", ">(0,0,1)"),
        ("<(Z,0,0)", "<(0,0,1)"),
        (">(0,Z,0)", ">(0,1,0)"),
        ("<(0,Z,0)", "<(0,1,0)"),
        (">(0,0,Z)", ">(0,0,1)"),
        ("<(0,0,Z)", "<(0,0,1)"),
        (">(X,0,0)", ">(1,0,0)"),
        ("<(X,0,0)", "<(1,0,0)"),
        (">(0,X,0)", ">(0,1,0)"),
        ("<(0,X,0)", "<(0,1,0)"),
        (">(0,0,X)", ">(1,0,0)"),
        ("<(0,0,X)", "<(1,0,0)"),
        (">(Y,0,0)", ">(0,1,0)"),
        ("<(Y,0,0)", "<(0,1,0)"),
        (">(0,Y,0)", ">(0,1,0)"),
        ("<(0,Y,0)", "<(0,1,0)"),
        (">(0,0,Y)", ">(0,0,1)"),
        ("<(0,0,Y)", "<(0,0,1)"),
        ("|(Z)", "|Z"),
        ("|(X)", "|X"),
        ("|(Y)", "|Y"),
        ("|(0,0,Z)", "|(0,0,1)"),
        ("|(0,Z,0)", "|(0,1,0)"),
        ("|(Z,0,0)", "|(1,0,0)"),
        ("|>Z", "|Z"),
    )
    for bad, good in pairs:
        code = code.replace(bad, good)
    return code


def _fix_transformed_origin_kw(code: str) -> str:
    """LLMs use transformed(origin=...); CadQuery 2.x only has offset= and rotate=."""
    return re.sub(
        r"\.transformed\s*\(\s*origin\s*=",
        ".transformed(offset=",
        code,
    )


def _split_first_depth0_comma(s: str):
    """Split at first comma at nesting depth 0 (respects strings and parens)."""
    depth = 0
    i = 0
    n = len(s)
    in_str = None
    while i < n:
        c = s[i]
        if in_str:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in "\"'":
            in_str = c
            i += 1
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            return s[:i].strip(), s[i + 1 :].strip()
        i += 1
    return s.strip(), ""


def _rest_starts_with_keyword_arg(rest: str) -> bool:
    return bool(re.match(r"^[A-Za-z_]\w*\s*=", rest))


def _expr_has_depth0_comma(s: str) -> bool:
    """True if `s` contains a comma at nesting depth 0 (not inside parens/strings)."""
    depth = 0
    i = 0
    n = len(s)
    in_str = None
    while i < n:
        c = s[i]
        if in_str:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in "\"'":
            in_str = c
            i += 1
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            return True
        i += 1
    return False


def _center_expr_needs_star_unpack(expr: str) -> bool:
    """
    CadQuery Workplane.center(x, y, z=None) takes separate floats, not one tuple.
    Rewrite .center((a,b,c)) -> .center(*(a,b,c)).
    """
    s = expr.strip()
    if len(s) < 2:
        return False
    if s[0] == "(" and s[-1] == ")":
        if _matching_close_paren(s, 0) == len(s) - 1:
            inner = s[1:-1].strip()
            return bool(inner) and _expr_has_depth0_comma(inner)
    if s[0] == "[" and s[-1] == "]":
        depth = 0
        in_str = None
        end = -1
        for i, c in enumerate(s):
            if in_str:
                if c == "\\":
                    continue
                if c == in_str:
                    in_str = None
                continue
            if c in "\"'":
                in_str = c
                continue
            if c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end == len(s) - 1:
            inner = s[1:-1].strip()
            return bool(inner) and _expr_has_depth0_comma(inner)
    return False


def _fix_workplane_center_kwarg(code: str) -> str:
    """
    LLMs pass center= to .workplane(); CadQuery raises TypeError (no such kwarg).
    Also fixes illegal .workplane(..., center=expr, pos) (positional after keyword).

    Rewrites to .workplane(remaining_kwargs).center(...) using *unpack for tuple/list
    center coordinates so CadQuery gets x, y, z as separate arguments.
    """
    needle = ".workplane("
    out = []
    pos = 0
    while True:
        idx = code.find(needle, pos)
        if idx < 0:
            out.append(code[pos:])
            return "".join(out)
        open_paren = idx + len(needle) - 1
        close_paren = _matching_close_paren(code, open_paren)
        if close_paren < 0:
            out.append(code[pos : idx + len(needle)])
            pos = idx + len(needle)
            continue
        segment = code[open_paren + 1 : close_paren]
        key = "center="
        k = segment.find(key)
        if k < 0:
            out.append(code[pos : close_paren + 1])
            pos = close_paren + 1
            continue

        before = segment[:k].rstrip().rstrip(",").strip()
        after = segment[k + len(key) :].lstrip()
        expr, tail = _split_first_depth0_comma(after)
        if not expr:
            out.append(code[pos : close_paren + 1])
            pos = close_paren + 1
            continue

        star = "*" if _center_expr_needs_star_unpack(expr) else ""
        if tail and _rest_starts_with_keyword_arg(tail):
            remaining = f"{before}, {tail}" if before else tail
            center_call = f".center({star}{expr})"
        elif tail:
            remaining = before
            center_call = f".center({star}{expr}, {tail})"
        else:
            remaining = before
            center_call = f".center({star}{expr})"

        inner = remaining if remaining else ""
        fixed = f".workplane({inner}){center_call}"
        out.append(code[pos:idx])
        out.append(fixed)
        pos = close_paren + 1


class _ChainUnionCutFixer(ast.NodeTransformer):
    """
    LLMs often emit base.union(a, b, c, ...) which raises TypeError in CadQuery 2.x
    (only one solid per .union() / .cut()). Rewrite to .union(a).union(b).union(c)...
    """

    _NAMES = frozenset({"union", "cut"})

    def visit_Call(self, node: ast.Call) -> ast.AST:
        self.generic_visit(node)
        if not isinstance(node.func, ast.Attribute):
            return node
        if node.func.attr not in self._NAMES:
            return node
        if len(node.args) <= 1:
            return node
        if any(isinstance(a, ast.Starred) for a in node.args):
            return node

        left = ast.Call(
            func=ast.Attribute(value=node.func.value, attr=node.func.attr, ctx=ast.Load()),
            args=[node.args[0]],
            keywords=list(node.keywords),
        )
        for arg in node.args[1:]:
            left = ast.Call(
                func=ast.Attribute(value=left, attr=node.func.attr, ctx=ast.Load()),
                args=[arg],
                keywords=[],
            )
        return left


def _rewrite_chained_union_cut(src: str) -> str:
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return src
    tree = _ChainUnionCutFixer().visit(tree)
    ast.fix_missing_locations(tree)
    try:
        return ast.unparse(tree)
    except AttributeError:
        return src


def _export_tolerances():
    if os.environ.get("MECHAGEN_HIGH_DETAIL", "").strip() in ("1", "true", "yes"):
        return 0.002, 0.035
    return 0.004, 0.05


def run_cadquery():
    # Read the AI-generated Python code from stdin
    code = sys.stdin.read()
    # Defensive: strip markdown fences if the model ignored instructions
    c = code.strip()
    if c.startswith("```"):
        lines = c.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines)
    if not code.strip():
        print("Error: No code provided", file=sys.stderr)
        sys.exit(1)

    code = _fix_selector_string_typos(code)
    code = _fix_transformed_origin_kw(code)
    code = _fix_workplane_center_kwarg(code)
    code = _rewrite_chained_union_cut(code)

    # Fillet/chamfer often trigger OCCT BRep_API failures on union-heavy AI geometry.
    # Opt out with MECHAGEN_KEEP_FINISH_OPS=1 (advanced only).
    if os.environ.get("MECHAGEN_KEEP_FINISH_OPS", "").strip() not in ("1", "true", "yes"):
        code = _strip_cq_finish_ops(code)

    # Output path for the STL
    if len(sys.argv) < 2:
        print("Error: Output STL path required as first argument", file=sys.stderr)
        sys.exit(1)

    out_path = sys.argv[1]

    # Safe execution environment — models often use math.* but forget import math
    global_env = {
        'cq': cq,
        'cadquery': cq,
        'math': math,
        '__builtins__': __builtins__,
    }

    final_model = None

    def show_object(model, *args, **kwargs):
        nonlocal final_model
        final_model = model

    global_env['show_object'] = show_object

    def _exec_and_get_model(src):
        nonlocal final_model
        final_model = None
        _patch_cq_union_cut_chain()
        local_env = dict(global_env)
        local_env['show_object'] = show_object
        f_out = io.StringIO()
        f_err = io.StringIO()
        with redirect_stdout(f_out), redirect_stderr(f_err):
            exec(src, local_env)

        if final_model is not None:
            return final_model
        if 'result' in local_env and (getattr(local_env['result'], 'val', None) or hasattr(local_env.get('result'), 'exportStl')):
            return local_env['result']
        candidates = [v for k, v in local_env.items() if isinstance(v, (cq.Workplane, cq.Assembly, cq.Shape))]
        if not candidates:
            raise RuntimeError("No CadQuery Workplane/Assembly assigned to 'result' or show_object().")
        return candidates[-1]

    try:
        model = _exec_and_get_model(code)
    except Exception as first_err:
        first_tb = traceback.format_exc()
        err_lower = str(first_err).lower()
        retryable = any(kw in err_lower for kw in (
            "chamfer", "fillet", "brep_api", "command not done", "null shape",
        ))
        if retryable:
            print(f"[runner] First attempt failed ({first_err}), retrying without chamfer/fillet…", file=sys.stderr)
            stripped = _strip_cq_finish_ops(code)
            try:
                model = _exec_and_get_model(stripped)
            except Exception:
                print(first_tb, file=sys.stderr)
                sys.exit(1)
        else:
            print(first_tb, file=sys.stderr)
            sys.exit(1)

    try:
        tol, ang = _export_tolerances()
        cq.exporters.export(model, out_path, tolerance=tol, angularTolerance=ang)
        print("SUCCESS")
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    run_cadquery()
