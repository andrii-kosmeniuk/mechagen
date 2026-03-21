import re

with open('frontend/src/components/Viewport3D.tsx', 'r') as f:
    content = f.read()

# 1. Add STLLoader import
content = content.replace(
    "import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';",
    "import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';\nimport { STLLoader } from 'three/examples/jsm/loaders/STLLoader';"
)

# 2. Add STL decoding function
stl_decoder = """
function loadStlBase64(b64: string): THREE.Group {
  const binaryString = window.atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const loader = new STLLoader();
  const geometry = loader.parse(bytes.buffer);
  geometry.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#8a9aaa',
    metalness: 0.92,
    roughness: 0.15,
    envMapIntensity: 3.0
  });
  
  const mesh = new THREE.Mesh(geometry, mat);
  
  // Center and scale to fit viewport loosely
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const pivotY = box.min.y;
  
  mesh.position.set(-center.x, -pivotY, -center.z);
  
  const group = new THREE.Group();
  group.add(mesh);
  // CadQuery normally exports Z-up. Threejs is Y-up.
  group.rotation.x = -Math.PI / 2;
  
  return group;
}
"""

content = content.replace("function detectType(prompt: string): string {", stl_decoder + "\nfunction detectType(prompt: string): string {")

# 3. Replace the old render loop
old_try_block = """      // 1) Parse JSCAD code
      const JSCAD_CODE = geomData.code;"""

new_try_block = """      // 1) Load STL from base64
      if (!geomData.stl) {
        throw new Error("No STL data returned from AI. Still generating?");
      }
      const group = loadStlBase64(geomData.stl);
      scene.add(group);
      groupRef.current = group;
"""

# We need to find the entire `useEffect` block for `geomData`
# Instead of regex trickery, let's just replace the whole try block contents manually.

# Find the block inside useEffect([geomData])
match = re.search(r'    useEffect\(\(\) => \{\n      if \(!geomData \|\| !geomData\.code\) return;\n\n      try \{([\s\S]*?)      \} catch \(err\) \{', content)
if match:
    content = content[:match.start(1)] + "\n" + new_try_block + "      " + content[match.end(1):]


with open('frontend/src/components/Viewport3D.tsx', 'w') as f:
    f.write(content)

print("Viewport3D updated successfully")
