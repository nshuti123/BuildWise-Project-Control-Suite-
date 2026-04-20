const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\NSHUTI\\Desktop\\BuildWise\\frontend\\src';
const modals = [
  'components/CreateProjectModal.tsx',
  'components/AddTaskModal.tsx',
  'components/SupplierModal.tsx',
  'components/ProfileModal.tsx',
  'components/NewOrderModal.tsx',
  'components/MaterialModal.tsx',
];

modals.forEach(m => {
  const p = path.join(dir, m);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    
    // Add import if missing
    if (!content.includes('createPortal')) {
      content = content.replace("import React", "import React, { useState, useEffect } from 'react';\nimport { createPortal } from 'react-dom';\nimport React"); 
      // A quick hack: maybe it doesn't have "import React", let's just inject at the top
      content = `import { createPortal } from 'react-dom';\n` + content;
    }

    // Wrap the top div
    if(content.includes('<div className="fixed inset-0')) {
      content = content.replace(
        /(return\s*\(\s*)(<div className="fixed inset-0[\s\S]*?)(;\s*\}$|\s*\}\s*$)/m,
        (match, p1, p2, p3) => {
          // find the matching closing tag for the main div if possible or just wrap the whole expression
          return `${p1}createPortal(\n${p2},\n    document.body\n  )${p3}`;
        }
      );
      fs.writeFileSync(p, content, 'utf8');
      console.log('Fixed', m);
    }
  }
});
