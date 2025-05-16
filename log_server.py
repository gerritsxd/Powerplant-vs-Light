"""
Enhanced web server with logging capabilities for the Power Plant Visualization project.
This server handles both serving the website files and logging user interactions.
"""
import http.server
import socketserver
import os
import json
import time
import datetime
import threading
import urllib.parse
from http import HTTPStatus

# Configuration
PORT = 8888
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(DIRECTORY, "session_logs")

# Create logs directory if it doesn't exist
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

class LoggingHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")
    
    def do_POST(self):
        """Handle POST requests for logging user activity."""
        if self.path == "/log":
            # Get content length
            content_length = int(self.headers['Content-Length'])
            # Read the request body
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse the JSON data
                log_data = json.loads(post_data.decode('utf-8'))
                
                # Add timestamp if not present
                if 'server_timestamp' not in log_data:
                    log_data['server_timestamp'] = datetime.datetime.now().isoformat()
                
                # Add client IP address
                log_data['client_ip'] = self.client_address[0]
                
                # Get session ID from the log data
                session_id = log_data.get('sessionId', 'unknown')
                
                # Create a session-specific log file
                log_filename = os.path.join(LOGS_DIR, f"session_{session_id}.json")
                
                # Append to the log file
                with open(log_filename, 'a') as log_file:
                    log_file.write(json.dumps(log_data) + "\n")
                
                # Send success response
                self.send_response(HTTPStatus.OK)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')  # Allow CORS
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
                
                print(f"Logged event: {log_data.get('type', 'unknown')} for session {session_id}")
                
            except Exception as e:
                # Send error response
                self.send_response(HTTPStatus.BAD_REQUEST)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')  # Allow CORS
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                print(f"Error logging data: {str(e)}")
        else:
            # Handle 404 for other POST requests
            self.send_response(HTTPStatus.NOT_FOUND)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": "Not found"}).encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight."""
        self.send_response(HTTPStatus.OK)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    """Run the web server with the logging handler."""
    with socketserver.TCPServer(("", PORT), LoggingHandler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        print(f"Open your browser and navigate to: http://localhost:{PORT}/index.html")
        print(f"User logs will be saved to: {LOGS_DIR}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
