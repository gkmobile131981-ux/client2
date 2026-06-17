import re

files = [
    r'd:\Ayub_backup\ClientProjects\client2\frontend\src\pages\Reports.tsx',
    r'd:\Ayub_backup\ClientProjects\client2\frontend\src\pages\Repairs.tsx',
    r'd:\Ayub_backup\ClientProjects\client2\frontend\src\pages\Dashboard.tsx',
    r'd:\Ayub_backup\ClientProjects\client2\frontend\src\pages\CustomerProfile.tsx',
]

rupee = '\u20b9'

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Replace dollar signs before Number() amounts in JSX
    new_content = content.replace('${Number(', rupee + '{Number(')
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed: {path}')
    else:
        print(f'No change: {path}')
