"""Serve the actual TV UI and the retained design gallery on this Mac."""
import argparse
import io
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from font_assets import font_overlay
import wallpaper_overlay

ROOT = Path(__file__).resolve().parents[1]


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


class Preview(SimpleHTTPRequestHandler):
    def send_bytes(self, content, kind):
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        return io.BytesIO(content)

    def send_head(self):
        route = unquote(urlsplit(self.path).path)
        # Personal wallpapers from .local/wallpapers/ are served beside app/, never copied into it.
        if self.server.include_personal_wallpapers:
            files = wallpaper_overlay.overlay_files()
            if files and route in ['/home', '/home/', '/home/index.html']:
                html = wallpaper_overlay.inject_script((ROOT / 'app/index.html').read_text(encoding='utf-8'))
                return self.send_bytes(html.encode('utf-8'), 'text/html; charset=utf-8')
            relative = route[len('/home/'):] if route.startswith('/home/') else route[1:]
            if relative in files:
                return self.send_bytes(files[relative].read_bytes(), self.guess_type(route))
        if route in ['/home/assets/font-catalog.js', '/home/assets/private-fonts.css'] or route.startswith('/home/assets/private-fonts/'):
            source = font_overlay(include_private=self.server.include_private_fonts).get(route[len('/home/'):])
            if source is None:
                self.send_error(404, 'File not found')
                return None
            content = source.read_bytes() if isinstance(source, Path) else source
            return self.send_bytes(content, self.guess_type(route))
        return super().send_head()

    def translate_path(self, path):
        route = urlsplit(path).path
        # Serve only the packaged UI and offline material-builder inputs.
        if route == '/' or route == '/home':
            return str(ROOT / 'app/index.html')
        if route.startswith('/home/'):
            self.directory = str(ROOT / 'app')
            return super().translate_path(route[5:])
        if route.startswith('/build/'):
            self.directory = str(ROOT / 'scripts/materials')
            return super().translate_path(route[6:])
        self.directory = str(ROOT / 'app')
        return super().translate_path(route)

    def do_GET(self):
        if urlsplit(self.path).path == '/':
            self.send_response(302)
            self.send_header('Location', '/home/')
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4795)
    parser.add_argument('--public-fonts', action='store_true', help='Use only the fonts and wallpapers distributed with the source')
    parser.add_argument('--no-personal-wallpapers', action='store_true', help='Leave out photos added with scripts/add-wallpapers.py')
    args = parser.parse_args()
    server = PreviewServer(('127.0.0.1', args.port), Preview)
    server.include_private_fonts = not args.public_fonts
    # Public mode, the flag or CLEANFRAME_PERSONAL_WALLPAPERS=0 show only the bundled fifteen.
    server.include_personal_wallpapers = not args.public_fonts and not args.no_personal_wallpapers and wallpaper_overlay.enabled()
    print('CleanFrame preview: http://127.0.0.1:' + str(server.server_port) + '/home/', flush=True)
    server.serve_forever()
