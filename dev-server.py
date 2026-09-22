import http.server
import socketserver
import os
import json
import mimetypes
import re
import urllib.parse

PORT = 8000
DIRECTORY = r"d:\Antigravity\Work"

def save_portfolio_to_disk(projects_data):
    """Permanently writes projects dataset to js/portfolio-data.js and deploy_ready."""
    json_str = json.dumps(projects_data, indent=2, ensure_ascii=False)
    target_files = [
        os.path.join(DIRECTORY, 'js', 'portfolio-data.js'),
        os.path.join(DIRECTORY, 'deploy_ready', 'js', 'portfolio-data.js')
    ]
    saved_count = 0
    for target in target_files:
        if not os.path.exists(target):
            continue
        try:
            with open(target, 'r', encoding='utf-8') as f:
                content = f.read()
            marker = 'const DEFAULT_PORTFOLIO_PROJECTS = '
            idx_start = content.find(marker)
            if idx_start == -1:
                continue
            sub = content[idx_start + len(marker):]
            idx_end = sub.find('\n];')
            if idx_end == -1:
                idx_end = sub.find('];')
            if idx_end != -1:
                end_pos = idx_start + len(marker) + idx_end + 3
                new_content = content[:idx_start + len(marker)] + json_str + ';\n' + content[end_pos:]
                with open(target, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                saved_count += 1
                print(f"[API] Saved {len(projects_data)} projects to {target}")
        except Exception as e:
            print(f"[API Error] Failed writing to {target}: {e}")
    return saved_count

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Clean URLs
        clean_path = self.path.split('?')[0]
        if clean_path in ('/services', '/services/'):
            self.path = '/services.html'
            return super().do_GET()
        if clean_path in ('/about', '/about/'):
            self.path = '/about.html'
            return super().do_GET()
        if clean_path in ('/portfolio', '/portfolio/'):
            self.path = '/portfolio.html'
            return super().do_GET()
        if clean_path in ('/contact', '/contact/'):
            self.path = '/contact.html'
            return super().do_GET()

        # Handle HTTP 206 Range Requests and full streaming for MP4 video
        range_header = self.headers.get('Range')
        rel_path = urllib.parse.unquote(clean_path.lstrip('/'))
        local_path = os.path.join(DIRECTORY, rel_path.replace('/', os.sep))

        is_video = os.path.isfile(local_path) and local_path.lower().endswith(('.mp4', '.webm', '.ogg', '.mov'))

        if is_video:
            try:
                filesize = os.path.getsize(local_path)
                content_type, _ = mimetypes.guess_type(local_path)
                content_type = content_type or 'video/mp4'

                if range_header:
                    m = re.match(r'bytes=(\d*)-(\d*)', range_header)
                    if m:
                        start_str, end_str = m.groups()
                        if start_str and end_str:
                            start = int(start_str)
                            end = int(end_str)
                        elif start_str:
                            start = int(start_str)
                            end = filesize - 1
                        elif end_str:
                            start = filesize - int(end_str)
                            end = filesize - 1
                        else:
                            start = 0
                            end = filesize - 1

                        start = max(0, min(start, filesize - 1))
                        end = max(start, min(end, filesize - 1))
                        length = end - start + 1

                        self.send_response(206)
                        self.send_header('Content-Type', content_type)
                        self.send_header('Content-Range', f'bytes {start}-{end}/{filesize}')
                        self.send_header('Content-Length', str(length))
                        self.send_header('Accept-Ranges', 'bytes')
                        self.send_header('Cache-Control', 'public, max-age=3600')
                        super().end_headers()

                        with open(local_path, 'rb') as f:
                            f.seek(start)
                            bytes_left = length
                            chunk_size = 64 * 1024
                            while bytes_left > 0:
                                read_len = min(chunk_size, bytes_left)
                                chunk = f.read(read_len)
                                if not chunk:
                                    break
                                self.wfile.write(chunk)
                                bytes_left -= len(chunk)
                        return
                else:
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(filesize))
                    self.send_header('Accept-Ranges', 'bytes')
                    self.send_header('Cache-Control', 'public, max-age=3600')
                    super().end_headers()

                    with open(local_path, 'rb') as f:
                        chunk_size = 64 * 1024
                        while True:
                            chunk = f.read(chunk_size)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                    return
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                # Client closed or seeked - totally normal in HTML5 video streaming
                return
            except Exception as e:
                print(f"[Video Stream Error] {e}")
                return

        # Normal file delivery
        super().do_GET()

    def end_headers(self):
        clean_p = getattr(self, 'path', '').split('?')[0].lower()
        if not any(clean_p.endswith(ext) for ext in ('.mp4', '.webm', '.ogg', '.mov')):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/save-portfolio':
            length = int(self.headers.get('Content-Length', 0))
            data = self.rfile.read(length).decode('utf-8')
            try:
                parsed = json.loads(data)
                if isinstance(parsed, list) and len(parsed) > 0:
                    saved_count = save_portfolio_to_disk(parsed)
                    if saved_count > 0:
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"status": "saved_to_disk", "count": len(parsed)}).encode('utf-8'))
                        return
                    else:
                        raise Exception("No portfolio-data.js files were updated")
            except Exception as e:
                print(f"[API Error] Failed to save portfolio: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return
        super().do_POST()

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Dev server running with HTTP 206 Range Support and No-Cache on port {PORT}")
    httpd.serve_forever()
