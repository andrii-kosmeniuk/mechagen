import cadquery as cq
result = cq.Workplane("XY").circle(5).extrude(10)
cq.exporters.export(result, "test.stl")
print("Done")
