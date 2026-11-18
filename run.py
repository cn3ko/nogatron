"""Serve Nogatron locally and open it in the browser.

Run with ``python run.py``. Stop with Ctrl+C. Only the Python standard
library is used, so there is nothing to install.
"""

import argparse
import functools
import http.server
import pathlib
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent
HOST = '127.0.0.1'
DEFAULT_PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Serve files with caching turned off, so a reload shows the latest edits."""

    def end_headers(self) -> None:
        """Add a no-cache header before finishing the response headers."""
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        """Keep the console quiet apart from errors.

        :param format: message format string
        :param args: values for the format string
        """


def make_server(port: int) -> http.server.ThreadingHTTPServer:
    """Create the server, falling back to any free port if the port is taken.

    :param port: preferred port
    :return: server bound to the project folder
    """
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    try:
        return http.server.ThreadingHTTPServer((HOST, port), handler)
    except OSError:
        return http.server.ThreadingHTTPServer((HOST, 0), handler)


def main(port: int, open_browser: bool) -> None:
    """Start the server and keep it running until Ctrl+C.

    :param port: preferred port
    :param open_browser: open the game in the default browser when True
    """
    with make_server(port) as server:
        url = f'http://{HOST}:{server.server_address[1]}/'
        print(f'Nogatron is running at {url}')
        print('Press Ctrl+C to stop.')
        if open_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('Stopped.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run Nogatron locally.')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='port to use (default 8000)')
    parser.add_argument('--no-browser', action='store_true', help='do not open the browser')
    options = parser.parse_args()
    main(options.port, not options.no_browser)
