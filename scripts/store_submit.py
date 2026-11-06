#!/usr/bin/env python3
"""스토어 심사 제출 스크립트 (.github/workflows/store-submit.yml 에서 실행).

- ios:     App Store Connect API로 해당 버전에 TestFlight 빌드를 연결하고,
           업데이트 내용(whatsNew)을 채운 뒤 심사에 제출한다.
- android: Google Play Developer API로 내부 테스트 트랙의 릴리스를
           프로덕션 트랙으로 승격하고 검토를 요청한다(새 빌드를 올리지 않음).

--dry-run 이면 조회와 검증만 하고 아무것도 변경하지 않는다.

필요 환경 변수
  ios:     ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 내용)
  android: PLAY_SERVICE_ACCOUNT_JSON (서비스 계정 JSON 내용)
  공통:    RELEASE_NOTES
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

IOS_BUNDLE_ID = "mannachurch.meditationblossom"
ANDROID_PACKAGE = "app.mannadev.meditation"
ASC_BASE = "https://api.appstoreconnect.apple.com"
PLAY_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"

# 심사 제출 전, 수정 가능한 App Store 버전 상태
ASC_EDITABLE_STATES = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
}

REPO_ROOT = Path(__file__).resolve().parent.parent


def log(msg: str) -> None:
    print(msg, flush=True)


def fail(msg: str) -> None:
    print(f"::error::{msg}", flush=True)
    sys.exit(1)


def require_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value.strip():
        fail(f"환경 변수 {name} 가 비어 있습니다.")
    return value


def read_android_version_code() -> str:
    gradle = (REPO_ROOT / "android/app/build.gradle.kts").read_text(encoding="utf-8")
    match = re.search(r"versionCode\s*=\s*(\d+)", gradle)
    if not match:
        fail("android/app/build.gradle.kts 에서 versionCode 를 찾지 못했습니다.")
    return match.group(1)


# ---------------------------------------------------------------------------
# iOS — App Store Connect
# ---------------------------------------------------------------------------


class AppStoreConnect:
    def __init__(self, key_id: str, issuer_id: str, private_key: str) -> None:
        self.key_id = key_id
        self.issuer_id = issuer_id
        self.private_key = private_key
        self._token = ""
        self._token_exp = 0

    def _auth_header(self) -> dict[str, str]:
        import jwt  # PyJWT[crypto]

        now = int(time.time())
        if now > self._token_exp - 60:
            self._token_exp = now + 15 * 60
            self._token = jwt.encode(
                {"iss": self.issuer_id, "iat": now, "exp": self._token_exp, "aud": "appstoreconnect-v1"},
                self.private_key,
                algorithm="ES256",
                headers={"kid": self.key_id, "typ": "JWT"},
            )
        return {"Authorization": f"Bearer {self._token}"}

    def request(self, method: str, path: str, *, params: dict | None = None, body: dict | None = None) -> dict:
        resp = requests.request(
            method,
            f"{ASC_BASE}{path}",
            params=params,
            json=body,
            headers=self._auth_header(),
            timeout=60,
        )
        if resp.status_code >= 400:
            fail(f"ASC {method} {path} 실패 ({resp.status_code}): {resp.text}")
        return resp.json() if resp.content else {}


def ios_find_build(asc: AppStoreConnect, app_id: str, version: str, build_number: str | None, wait_minutes: int) -> dict:
    """해당 버전의 빌드를 찾고, 처리(VALID)가 끝날 때까지 기다린다."""
    params = {
        "filter[app]": app_id,
        "filter[preReleaseVersion.version]": version,
        "sort": "-uploadedDate",
        "limit": "1",
    }
    if build_number:
        params["filter[version]"] = build_number

    deadline = time.time() + wait_minutes * 60
    while True:
        builds = asc.request("GET", "/v1/builds", params=params)["data"]
        if builds:
            build = builds[0]
            state = build["attributes"].get("processingState")
            log(f"빌드 {build['attributes'].get('version')} 처리 상태: {state}")
            if state == "VALID":
                return build
            if state in {"FAILED", "INVALID"}:
                fail(f"빌드 처리 실패 상태: {state}")
        else:
            log(f"버전 {version} 빌드가 아직 App Store Connect에 없습니다.")
        if time.time() > deadline:
            fail(f"{wait_minutes}분 안에 처리 완료된 빌드를 찾지 못했습니다.")
        time.sleep(60)


def ios_find_or_create_version(asc: AppStoreConnect, app_id: str, version: str, dry_run: bool) -> dict | None:
    versions = asc.request(
        "GET",
        f"/v1/apps/{app_id}/appStoreVersions",
        params={"filter[versionString]": version, "filter[platform]": "IOS"},
    )["data"]
    if versions:
        return versions[0]
    if dry_run:
        log(f"[dry-run] App Store 버전 {version} 이 없어 새로 만들 예정입니다.")
        return None
    log(f"App Store 버전 {version} 생성")
    return asc.request(
        "POST",
        "/v1/appStoreVersions",
        body={
            "data": {
                "type": "appStoreVersions",
                "attributes": {"platform": "IOS", "versionString": version},
                "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
            }
        },
    )["data"]


def submit_ios(version: str, notes: str, build_number: str | None, wait_minutes: int, dry_run: bool) -> None:
    if len(notes) > 4000:
        fail("iOS 업데이트 내용은 4000자 이하여야 합니다.")

    asc = AppStoreConnect(require_env("ASC_KEY_ID"), require_env("ASC_ISSUER_ID"), require_env("ASC_PRIVATE_KEY"))

    apps = asc.request("GET", "/v1/apps", params={"filter[bundleId]": IOS_BUNDLE_ID})["data"]
    if not apps:
        fail(f"번들 ID {IOS_BUNDLE_ID} 앱을 찾지 못했습니다.")
    app_id = apps[0]["id"]
    log(f"앱 ID: {app_id}")

    build = ios_find_build(asc, app_id, version, build_number, wait_minutes)
    build_id = build["id"]

    app_version = ios_find_or_create_version(asc, app_id, version, dry_run)
    if app_version is not None:
        state = app_version["attributes"].get("appStoreState")
        log(f"App Store 버전 {version} 상태: {state}")
        if state not in ASC_EDITABLE_STATES:
            fail(f"버전 {version} 이 수정 가능한 상태가 아닙니다 ({state}). 이미 제출됐거나 출시된 버전일 수 있습니다.")

    if dry_run:
        log(f"[dry-run] 빌드 {build['attributes'].get('version')} 연결, 업데이트 내용 입력, 심사 제출을 건너뜁니다.")
        return

    version_id = app_version["id"]

    if build["attributes"].get("usesNonExemptEncryption") is None:
        log("빌드 수출 규정(암호화) 정보를 false 로 설정")
        asc.request(
            "PATCH",
            f"/v1/builds/{build_id}",
            body={"data": {"type": "builds", "id": build_id, "attributes": {"usesNonExemptEncryption": False}}},
        )

    log(f"빌드 {build['attributes'].get('version')} 를 버전 {version} 에 연결")
    asc.request(
        "PATCH",
        f"/v1/appStoreVersions/{version_id}/relationships/build",
        body={"data": {"type": "builds", "id": build_id}},
    )

    localizations = asc.request("GET", f"/v1/appStoreVersions/{version_id}/appStoreVersionLocalizations")["data"]
    if not localizations:
        fail("버전 현지화 정보가 없습니다. App Store Connect에서 버전 정보를 먼저 확인하세요.")
    for loc in localizations:
        log(f"업데이트 내용 입력: {loc['attributes'].get('locale')}")
        asc.request(
            "PATCH",
            f"/v1/appStoreVersionLocalizations/{loc['id']}",
            body={"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {"whatsNew": notes}}},
        )

    # 아직 제출하지 않은 심사 제출 묶음이 있으면 재사용
    open_submissions = asc.request(
        "GET",
        "/v1/reviewSubmissions",
        params={"filter[app]": app_id, "filter[platform]": "IOS", "filter[state]": "READY_FOR_REVIEW"},
    )["data"]
    if open_submissions:
        submission_id = open_submissions[0]["id"]
        log(f"기존 심사 제출 묶음 재사용: {submission_id}")
    else:
        submission_id = asc.request(
            "POST",
            "/v1/reviewSubmissions",
            body={
                "data": {
                    "type": "reviewSubmissions",
                    "attributes": {"platform": "IOS"},
                    "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                }
            },
        )["data"]["id"]
        log(f"심사 제출 묶음 생성: {submission_id}")

    items = asc.request("GET", f"/v1/reviewSubmissions/{submission_id}/items", params={"include": "appStoreVersion"})
    already = any(
        (item.get("relationships", {}).get("appStoreVersion", {}).get("data") or {}).get("id") == version_id
        for item in items.get("data", [])
    )
    if not already:
        asc.request(
            "POST",
            "/v1/reviewSubmissionItems",
            body={
                "data": {
                    "type": "reviewSubmissionItems",
                    "relationships": {
                        "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": submission_id}},
                        "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}},
                    },
                }
            },
        )

    asc.request(
        "PATCH",
        f"/v1/reviewSubmissions/{submission_id}",
        body={"data": {"type": "reviewSubmissions", "id": submission_id, "attributes": {"submitted": True}}},
    )
    log(f"iOS {version} 심사 제출 완료")


# ---------------------------------------------------------------------------
# Android — Google Play
# ---------------------------------------------------------------------------


def submit_android(version_code: str, notes: str, language: str, dry_run: bool) -> None:
    if len(notes) > 500:
        fail("Android 출시 노트는 500자 이하여야 합니다.")

    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account

    info = json.loads(require_env("PLAY_SERVICE_ACCOUNT_JSON"))
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    session = AuthorizedSession(creds)
    base = f"{PLAY_BASE}/{ANDROID_PACKAGE}"

    def call(method: str, path: str, body: dict | None = None) -> dict:
        resp = session.request(method, f"{base}{path}", json=body, timeout=60)
        if resp.status_code >= 400:
            fail(f"Play {method} {path} 실패 ({resp.status_code}): {resp.text}")
        return resp.json() if resp.content else {}

    edit_id = call("POST", "/edits")["id"]
    log(f"Play edit 생성: {edit_id}")

    internal = call("GET", f"/edits/{edit_id}/tracks/internal")
    release = next(
        (r for r in internal.get("releases", []) if version_code in r.get("versionCodes", [])),
        None,
    )
    if release is None:
        call("DELETE", f"/edits/{edit_id}")
        fail(f"내부 테스트 트랙에서 versionCode {version_code} 릴리스를 찾지 못했습니다.")
    log(f"내부 테스트 릴리스 확인: {release.get('name')} (versionCode {version_code})")

    production_release = {
        "name": release.get("name", version_code),
        "versionCodes": [version_code],
        "status": "completed",
        "releaseNotes": [{"language": language, "text": notes}],
    }
    call(
        "PUT",
        f"/edits/{edit_id}/tracks/production",
        body={"track": "production", "releases": [production_release]},
    )
    log("프로덕션 트랙에 릴리스 설정")

    if dry_run:
        # validate 로 커밋 가능 여부만 확인하고 edit 은 버린다
        call("POST", f"/edits/{edit_id}:validate")
        call("DELETE", f"/edits/{edit_id}")
        log("[dry-run] 검증 통과. 변경 내용은 커밋하지 않고 버렸습니다.")
        return

    call("POST", f"/edits/{edit_id}:commit")
    log(f"Android versionCode {version_code} 프로덕션 출시 검토 요청 완료")


# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="스토어 심사 제출")
    parser.add_argument("platform", choices=["ios", "android"])
    parser.add_argument("--version", required=True, help="마케팅 버전 (예: 1.2.23)")
    parser.add_argument("--ios-build-number", default="", help="iOS 빌드 번호. 비우면 해당 버전의 최신 빌드")
    parser.add_argument("--android-version-code", default="", help="비우면 build.gradle.kts 값 사용")
    parser.add_argument("--android-language", default="ko-KR")
    parser.add_argument("--wait-minutes", type=int, default=60, help="iOS 빌드 처리 대기 시간")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    notes = require_env("RELEASE_NOTES").strip()

    if args.platform == "ios":
        submit_ios(args.version, notes, args.ios_build_number or None, args.wait_minutes, args.dry_run)
    else:
        submit_android(args.android_version_code or read_android_version_code(), notes, args.android_language, args.dry_run)


if __name__ == "__main__":
    main()
