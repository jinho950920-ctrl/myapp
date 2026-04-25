import json
import re

log_file = "/mnt/c/Users/jinho/OneDrive/바탕 화면/api_logs.txt"

def analyze_logs():
    with open(log_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by separator
    blocks = content.split("-" * 70)
    
    apis = {}
    
    for block in blocks:
        url_match = re.search(r'(?:GET|POST)\s+(https://[^ \n]+)', block)
        if not url_match:
            continue
            
        url = url_match.group(1)
        base_url = url.split('?')[0]
        
        # Only care about business-insight related APIs
        if "wing-account" in base_url or "winglayout" in base_url or "/cmg-" in base_url:
            continue
            
        method_match = re.search(r'\[API\]|>>KEY<<.*?\n\s+(GET|POST)', block)
        method = method_match.group(1) if method_match else "UNKNOWN"
        
        payload_match = re.search(r'Payload:\s+(.*)\n', block)
        payload = payload_match.group(1) if payload_match else None
        
        status_match = re.search(r'Status:\s+(\d+)', block)
        status = status_match.group(1) if status_match else None
        
        response_match = re.search(r'Response.*?:\s+(.*)', block)
        response = response_match.group(1) if response_match else None
        
        if base_url not in apis:
            apis[base_url] = {
                "method": method,
                "url": url,
                "payloads": set(),
                "responses": set(),
                "status": set()
            }
            
        if payload:
            apis[base_url]["payloads"].add(payload[:1000])
        if response:
            apis[base_url]["responses"].add(response[:200])
        if status:
            apis[base_url]["status"].add(status)

    print("=== Extracted Target APIs ===\n")
    for base_url, data in apis.items():
        if True: # Removed filter to see all APIs
            print(f"[{data['method']}] {base_url}")
            print(f"  Full URL Example: {data['url']}")
            if data['payloads']:
                print(f"  Payload Example: {list(data['payloads'])[0][:200]}...")
            if data['status']:
                print(f"  Status: {list(data['status'])}")
            if data['responses']:
                resp = list(data['responses'])[0]
                is_akamai = "akamai" in resp.lower() or "<!doctype html>" in resp.lower()
                print(f"  Response Preview: {resp[:100]}{' ... [AKAMAI BLOCKED!]' if is_akamai else ''}")
            print("-" * 50)

if __name__ == "__main__":
    analyze_logs()
