import os
from app.models.config_db import load_config_to_env

def main():
    loaded = load_config_to_env()
    print(f"Loaded {loaded} env vars")
    print(f"BUFFER_ACCESS_TOKEN in os.environ: {'BUFFER_ACCESS_TOKEN' in os.environ}")
    print(f"BUFFER_ACCESS_TOKEN len: {len(os.environ.get('BUFFER_ACCESS_TOKEN', ''))}")

if __name__ == "__main__":
    main()
