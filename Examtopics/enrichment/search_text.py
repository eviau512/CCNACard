import os

text_to_search = "An engineer configured NAT translations and has verified"
for root, dirs, files in os.walk('Examtopics'):
    for file in files:
        if file.endswith(('.html', '.json', '.txt', '.js')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    data = f.read()
                    if text_to_search in data:
                        print(f"Found in {filepath}")
            except Exception as e:
                pass
