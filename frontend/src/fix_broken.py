import sys
import os

paths = [
    r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\NewOrderModal.tsx",
    r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\MaterialModal.tsx"
]

for p in paths:
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex-less replace to ensure we get the ending right
    if "document.body\n  );" not in content:
        content = content.replace("    </div>\n  );\n}", "    </div>,\n    document.body\n  );\n}")
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {p}")
