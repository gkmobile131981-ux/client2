path = r'd:\Ayub_backup\ClientProjects\client2\backend\src\controllers\repairs.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'notes: req.body.notes || null' in line and not line.rstrip().rstrip('\r\n').endswith(','):
        lines[i] = line.rstrip('\r\n').rstrip() + ',\n'
        print(f'Fixed comma at line {i+1}')
        break

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done.')
