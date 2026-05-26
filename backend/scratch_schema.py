import os
import ctypes

def get_drives():
    drives = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    for letter in map(chr, range(65, 91)):
        if bitmask & 1:
            drives.append(letter)
        bitmask >>= 1
    return drives

def run():
    print("Scanning for Google Drive Desktop Sync folders...")
    user_home = os.path.expanduser("~")
    
    potential_paths = [
        os.path.join(user_home, "Google Drive"),
        os.path.join(user_home, "Google 드라이브"),
        os.path.join(user_home, "OneDrive"),
    ]
    
    # Check other drive letters (Google Drive virtual drive G: or similar)
    drives = get_drives()
    for d in drives:
        potential_paths.append(f"{d}:\\My Drive")
        potential_paths.append(f"{d}:\\내 드라이브")
        potential_paths.append(f"{d}:\\Google Drive")
    
    found = False
    for path in potential_paths:
        if os.path.exists(path):
            print(f"Found directory: {path}")
            found = True
            
    if not found:
        print("No default Google Drive Desktop folders found.")

if __name__ == '__main__':
    run()
