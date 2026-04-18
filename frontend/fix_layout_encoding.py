import codecs
try:
    with open('c:/Smart_Proto_Investor_Plan/frontend/app/layout.tsx', 'rb') as f:
        content = f.read()

    try:
        decoded = content.decode('utf-8')
        print('Already UTF-8')
    except UnicodeDecodeError:
        try:
            decoded = content.decode('cp949')
            print('It was CP949, successfully decoded.')
        except UnicodeDecodeError:
            decoded = content.decode('utf-8', errors='replace')
            print('Replaced invalid utf-8 bytes.')
        
        with open('c:/Smart_Proto_Investor_Plan/frontend/app/layout.tsx', 'w', encoding='utf-8') as fw:
            fw.write(decoded)
        print('Converted to UTF-8 and saved.')
except Exception as e:
    print(e)
