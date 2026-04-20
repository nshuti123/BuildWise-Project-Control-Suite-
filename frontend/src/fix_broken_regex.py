import re

m_path = r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\MaterialModal.tsx"
with open(m_path, 'r', encoding='utf-8') as f:
    m_content = f.read()

m_content = re.sub(r'\{materialToEdit \? "Edit Material" : "Add New Material",[\r\n\s]*document\.body[\r\n\s]*\)\}', '{materialToEdit ? "Edit Material" : "Add New Material"}', m_content)
m_content = re.sub(r'    </div>[\r\n\s]*\);[\r\n\s]*\}', '    </div>,\n    document.body\n  );\n}', m_content)

with open(m_path, 'w', encoding='utf-8') as f:
    f.write(m_content)


n_path = r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\NewOrderModal.tsx"
with open(n_path, 'r', encoding='utf-8') as f:
    n_content = f.read()

n_content = re.sub(r'    </div>[\r\n\s]*\);[\r\n\s]*\}', '    </div>,\n    document.body\n  );\n}', n_content)

with open(n_path, 'w', encoding='utf-8') as f:
    f.write(n_content)

print("Done")
