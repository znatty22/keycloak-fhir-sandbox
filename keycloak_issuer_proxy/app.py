import os
import json
from urllib.parse import urlparse
from pprint import pprint

from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

KEYCLOAK_ISSUER_URL = (
    os.environ.get(
        "KEYCLOAK_ISSUER_URL") or "http://localhost:8080/realms/master"
)


def send_request(method, *args, **kwargs):
    """
    Send http request with proper error handling
    """
    try:
        requests_op = getattr(requests, method)
        resp = requests_op(*args, **kwargs)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print("Problem sending request to endpoint")
        print(resp.text)
        raise e

    return resp


def replace_str_in_dict(old_value, new_value, data_dict):
    """
    Recurse through data_dict, for string values, replace the substring
    `old_value` with `new_value
    """
    return json.loads(json.dumps(data_dict).replace(old_value, new_value))


@app.route('/.well-known/openid-configuration')
def openid_config():
    """
    Get the openid configuration from the Keycloak server running inside
    the docker network and replace "localhost" in all URLS with the
    docker container hostname for Keycloak so that other containers running
    in the docker network can access the URLs
    """
    resp = send_request(
        "get", f"{KEYCLOAK_ISSUER_URL}/.well-known/openid-configuration"
    )
    # Get hostname from issuer_url
    hostname = urlparse(KEYCLOAK_ISSUER_URL).netloc.split(":")[0]

    new_config = replace_str_in_dict("localhost", hostname, resp.json())

    return jsonify(new_config)


if __name__ == "__main__":
    app.run(
        host='0.0.0.0', port=os.environ.get("FLASK_SERVER_PORT"), debug=True
    )
