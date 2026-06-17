path = r'd:\Ayub_backup\ClientProjects\client2\backend\src\controllers\repairs.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line 193 (0-indexed: 192) which has: notes: req.body.notes || null
for i, line in enumerate(lines):
    if 'notes: req.body.notes' in line and '}' in lines[i+1]:
        # Insert services line after this line, before the closing }
        lines.insert(i+1, '      services: req.body.services ? JSON.parse(req.body.services) : []\n')
        print(f'Inserted services at line {i+2}')
        break

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done.')
