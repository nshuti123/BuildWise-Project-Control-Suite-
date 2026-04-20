import os

paths = [
    r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\SupplierModal.tsx",
    r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\ProfileModal.tsx",
    r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\NewOrderModal.tsx",
    r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\MaterialModal.tsx"
]

for p in paths:
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We injected `return (\n    createPortal(`
    # So the bottom should be `), document.body\n  )\n)` but right now it is `), document.body\n  )`
    # The ending right now is:
    #     </div>,
    #     document.body
    #   );
    # }
    
    # Which only closes ONE expression. We must close BOTH!
    if "  );\n}" in content and "  )\n  );\n}" not in content and "  ));\n}" not in content:
        content = content.replace("    document.body\n  );\n}", "    document.body\n  )\n  );\n}")
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {p}")

print("Done")
