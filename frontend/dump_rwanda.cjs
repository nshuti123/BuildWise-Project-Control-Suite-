const fs = require('fs');
const r = require('rwanda');

const tree = [];
let idCounter = 1;

for (const p of r.Provinces()) {
    const pId = idCounter++;
    tree.push({ id: pId, name: p, level: 'PROVINCE', parent: null });
    
    const districts = r.Districts({ provinces: p }) || [];
    for (const d of districts) {
        const dId = idCounter++;
        tree.push({ id: dId, name: d, level: 'DISTRICT', parent: pId });
        
        const sectors = r.Sectors({ province: p, district: d }) || [];
        for (const s of sectors) {
            const sId = idCounter++;
            tree.push({ id: sId, name: s, level: 'SECTOR', parent: dId });
            
            const cells = r.Cells({ province: p, district: d, sector: s }) || [];
            for (const c of cells) {
                const cId = idCounter++;
                tree.push({ id: cId, name: c, level: 'CELL', parent: sId });
                
                const villages = r.Villages({ province: p, district: d, sector: s, cell: c }) || [];
                for (const v of villages) {
                    const vId = idCounter++;
                    tree.push({ id: vId, name: v, level: 'VILLAGE', parent: cId });
                }
            }
        }
    }
}

fs.writeFileSync('c:\\Users\\NSHUTI\\Desktop\\BuildWise\\backend\\rwanda_data.json', JSON.stringify(tree));
console.log('Done, total rows:', tree.length);
