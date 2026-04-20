import os

path = r"c:\Users\NSHUTI\Desktop\BuildWise\frontend\src\components\CreateProjectModal.tsx"
with open(path, "r", encoding="utf-8") as f:
    c = f.read()

# 1. Remove rwanda import
c = c.replace('import { Provinces, Districts, Sectors, Cells, Villages } from "rwanda";', '')

# 2. Add React lists state
STATES = """  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [sector, setSector] = useState("");
  const [cell, setCell] = useState("");
  const [village, setVillage] = useState("");

  const [provincesList, setProvincesList] = useState<{id: number, name: string}[]>([]);
  const [districtsList, setDistrictsList] = useState<{id: number, name: string}[]>([]);
  const [sectorsList, setSectorsList] = useState<{id: number, name: string}[]>([]);
  const [cellsList, setCellsList] = useState<{id: number, name: string}[]>([]);
  const [villagesList, setVillagesList] = useState<{id: number, name: string}[]>([]);
"""
c = c.replace('  const [province, setProvince] = useState("");\n  const [district, setDistrict] = useState("");\n  const [sector, setSector] = useState("");\n  const [cell, setCell] = useState("");\n  const [village, setVillage] = useState("");\n', STATES)

# 3. Add useEffects for fetching
EFFECTS = """      setVillage("");
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      api.get("/locations/?parent=null").then((res) => setProvincesList(res.data));
    }
  }, [isOpen]);

  useEffect(() => {
    if (province) {
      api.get(`/locations/?parent=${province}`).then((res) => setDistrictsList(res.data));
    } else {
      setDistrictsList([]);
    }
  }, [province]);

  useEffect(() => {
    if (district) {
      api.get(`/locations/?parent=${district}`).then((res) => setSectorsList(res.data));
    } else {
      setSectorsList([]);
    }
  }, [district]);

  useEffect(() => {
    if (sector) {
      api.get(`/locations/?parent=${sector}`).then((res) => setCellsList(res.data));
    } else {
      setCellsList([]);
    }
  }, [sector]);

  useEffect(() => {
    if (cell) {
      api.get(`/locations/?parent=${cell}`).then((res) => setVillagesList(res.data));
    } else {
      setVillagesList([]);
    }
  }, [cell]);
"""
c = c.replace('      setVillage("");\n      setError("");\n    }\n  }, [isOpen]);\n', EFFECTS)

# 4. Modify handleSubmit
c = c.replace('      const locationString = `${province}, ${district}, ${sector}, ${cell}, ${village}`;\n      await api.post("/projects/", { ...formData, location: locationString });', '      await api.post("/projects/", { ...formData, location: village });')

# 5. Update dropdown maps
c = c.replace('                {Provinces().map((p: string) => (\n                  <option key={p} value={p}>\n                    {p}\n                  </option>\n                ))}', '                {provincesList.map((p) => (\n                  <option key={p.id} value={p.id}>\n                    {p.name}\n                  </option>\n                ))}')

c = c.replace('                {province &&\n                  Districts({ provinces: province as any })?.map((d: string) => (\n                    <option key={d} value={d}>\n                      {d}\n                    </option>\n                  ))}', '                {districtsList.map((p) => (\n                  <option key={p.id} value={p.id}>\n                    {p.name}\n                  </option>\n                ))}')

c = c.replace('                {district &&\n                  Sectors({ province: province as any, district: district as any })?.map((s: string) => (\n                    <option key={s} value={s}>\n                      {s}\n                    </option>\n                  ))}', '                {sectorsList.map((p) => (\n                  <option key={p.id} value={p.id}>\n                    {p.name}\n                  </option>\n                ))}')

c = c.replace('                {sector &&\n                  Cells({ province: province as any, district: district as any, sector })?.map((c: string) => (\n                    <option key={c} value={c}>\n                      {c}\n                    </option>\n                  ))}', '                {cellsList.map((p) => (\n                  <option key={p.id} value={p.id}>\n                    {p.name}\n                  </option>\n                ))}')

c = c.replace('                {cell &&\n                  Villages({ province: province as any, district: district as any, sector, cell })?.map(\n                    (v: string) => (\n                      <option key={v} value={v}>\n                        {v}\n                      </option>\n                    ),\n                  )}', '                {villagesList.map((p) => (\n                  <option key={p.id} value={p.id}>\n                    {p.name}\n                  </option>\n                ))}')

c = c.replace('// @ts-ignore\n', '')

with open(path, "w", encoding="utf-8") as f:
    f.write(c)

print("Project Location Refactored")
