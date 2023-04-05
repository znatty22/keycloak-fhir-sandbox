import os
import json
from urllib.parse import urlparse
from pprint import pprint

from flask import Flask, request, jsonify
import requests

import auth

app = Flask(__name__)


@app.route('/auth-sandbox')
def auth_sandbox():
    """
    Test auth stuff out with keycloak
    """
    token = auth.get_access_token(
        client_id=request.args.get("client_id"),
        client_secret=request.args.get("client_secret")
    )
    return jsonify(token)


if __name__ == "__main__":
    app.run(
        host='0.0.0.0', port=os.environ.get("FLASK_SERVER_PORT"), debug=True
    )
