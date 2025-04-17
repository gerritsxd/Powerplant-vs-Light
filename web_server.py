"""
Simple HTTP server to serve the power plant visualization map.
"""
import http.server
import socketserver
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"Open your browser and navigate to: http://localhost:{PORT}/index.html")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
