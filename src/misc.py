import time

import requests

from src.config import (
    BASE_URL,
)


def elapsed_time_hms(start_time):
    """
    Get time elapsed since start_time in hh:mm:ss str format
    """
    elapsed = time.time() - start_time
    return time.strftime('%H:%M:%S', time.gmtime(elapsed))


def get_oauth2_token(client_id, client_secret):
    """
    Exchange client credentials for Bearer token
    """
    print(f"Get Bearer token for {client_id}")
    headers = {
        "Content-Type": "application/json",
    }
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials"
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/token",
            headers=headers,
            json=payload
        )
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print("Problem sending request to aidbox")
        print(resp.text)
        raise e

    return resp.json()["access_token"]
