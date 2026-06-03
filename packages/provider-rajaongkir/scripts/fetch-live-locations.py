#!/usr/bin/env python3
"""
RajaOngkir live location regeneration script.

Crawls RajaOngkir V2 hierarchy endpoints and regenerates:
  packages/provider-rajaongkir/src/location/source/locations.yaml

This is a full rebuild from live provider data (level1 → level4).
It does NOT merge with or trust the old committed hierarchy.

Supports checkpoint/resume so a long crawl can survive interruptions.

Usage:
  export RAJAONGKIR_API_KEY=your-key
  python3 scripts/fetch-live-locations.py

Requirements:
  pip install pyyaml requests
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import requests
import yaml

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://rajaongkir.komerce.id/api/v1"
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "src",
    "location",
    "source",
    "locations.yaml",
)
CHECKPOINT_PATH = os.path.join(
    os.path.dirname(__file__),
    ".checkpoint.json",
)

RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1.0
REQUEST_DELAY_SECONDS = 2.5  # base pacing between normal requests

# 429 back-off: first 30s, second 60s, third 120s
RATE_LIMIT_BACKOFF_SECONDS = [30, 60, 120]


# ---------------------------------------------------------------------------
# API client
# ---------------------------------------------------------------------------

class RajaOngkirCrawlError(Exception):
    pass


def get_api_key() -> str:
    key = os.environ.get("RAJAONGKIR_API_KEY", "").strip()
    if not key:
        raise RajaOngkirCrawlError(
            "Environment variable RAJAONGKIR_API_KEY is required but not set."
        )
    return key


def mask_key(key: str) -> str:
    if len(key) <= 8:
        return "***"
    return key[:4] + "..." + key[-4:]


def api_get(path: str, api_key: str) -> list[dict[str, Any]]:
    url = f"{BASE_URL}{path}"
    consecutive_429s = 0
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            response = requests.get(
                url,
                headers={"key": api_key},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()

            if not isinstance(payload, dict):
                raise RajaOngkirCrawlError(
                    f"Unexpected response shape for {path}: root is not an object"
                )

            data = payload.get("data")
            if not isinstance(data, list):
                raise RajaOngkirCrawlError(
                    f"Unexpected response shape for {path}: 'data' is not a list"
                )

            return data

        except requests.exceptions.HTTPError as exc:
            # Use 'is not None' so a real 429 response is not misreported as HTTP 0
            status = exc.response.status_code if exc.response is not None else 0
            if status == 429:
                consecutive_429s += 1
                backoff_index = min(consecutive_429s, len(RATE_LIMIT_BACKOFF_SECONDS)) - 1
                delay = RATE_LIMIT_BACKOFF_SECONDS[backoff_index]
                print(
                    f"  Rate limited (429) on {path} — "
                    f"consecutive={consecutive_429s}, backing off {delay}s…"
                )
                time.sleep(delay)
                continue
            if status >= 500:
                if attempt < RETRY_ATTEMPTS:
                    print(f"  Upstream error {status} on {path}, retrying in {RETRY_DELAY_SECONDS * attempt:.0f}s…")
                    time.sleep(RETRY_DELAY_SECONDS * attempt)
                    continue
            raise RajaOngkirCrawlError(
                f"HTTP {status} on {path}: {exc}"
            ) from exc

        except requests.exceptions.RequestException as exc:
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS * attempt)
                continue
            raise RajaOngkirCrawlError(
                f"Request failed on {path} after {RETRY_ATTEMPTS} attempts: {exc}"
            ) from exc

    raise RajaOngkirCrawlError(f"Exhausted retries for {path}")


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize_name(name: str) -> str:
    """Trim, collapse duplicate spaces, uppercase."""
    return " ".join(name.strip().split()).upper()


def build_city_aliases(raw_name: str, normalized_name: str) -> list[str]:
    """
    For typed cities (KOTA/KABUPATEN), add an alias without the type prefix.
    Only adds the alias when the removal produces a different, non-empty name.
    """
    aliases: list[str] = []
    for prefix in ("KOTA ", "KABUPATEN "):
        if normalized_name.startswith(prefix):
            alias = normalized_name[len(prefix):].strip()
            if alias and alias != normalized_name:
                aliases.append(alias)
            break
    return aliases


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class Subdistrict:
    live_id: str
    name: str
    postal_codes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "live_id": self.live_id,
            "name": self.name,
            "postal_codes": self.postal_codes,
        }

    @staticmethod
    def from_dict(d: dict) -> Subdistrict:
        return Subdistrict(
            live_id=d["live_id"],
            name=d["name"],
            postal_codes=d.get("postal_codes", []),
        )


@dataclass
class District:
    live_id: str
    name: str
    subdistricts: list[Subdistrict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "live_id": self.live_id,
            "name": self.name,
            "subdistricts": [s.to_dict() for s in self.subdistricts],
        }

    @staticmethod
    def from_dict(d: dict) -> District:
        return District(
            live_id=d["live_id"],
            name=d["name"],
            subdistricts=[Subdistrict.from_dict(s) for s in d.get("subdistricts", [])],
        )


@dataclass
class City:
    live_id: str
    name: str
    aliases: list[str] = field(default_factory=list)
    districts: list[District] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "live_id": self.live_id,
            "name": self.name,
            "aliases": self.aliases,
            "districts": [d.to_dict() for d in self.districts],
        }

    @staticmethod
    def from_dict(d: dict) -> City:
        return City(
            live_id=d["live_id"],
            name=d["name"],
            aliases=d.get("aliases", []),
            districts=[District.from_dict(x) for x in d.get("districts", [])],
        )


@dataclass
class Province:
    live_id: str
    name: str
    aliases: list[str] = field(default_factory=list)
    cities: list[City] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "live_id": self.live_id,
            "name": self.name,
            "aliases": self.aliases,
            "cities": [c.to_dict() for c in self.cities],
        }

    @staticmethod
    def from_dict(d: dict) -> Province:
        return Province(
            live_id=d["live_id"],
            name=d["name"],
            aliases=d.get("aliases", []),
            cities=[City.from_dict(c) for c in d.get("cities", [])],
        )


# ---------------------------------------------------------------------------
# Checkpoint / Resume
# ---------------------------------------------------------------------------

def save_checkpoint(provinces: list[Province]) -> None:
    payload = [p.to_dict() for p in provinces]
    with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def load_checkpoint() -> list[Province] | None:
    if not os.path.exists(CHECKPOINT_PATH):
        return None
    print(f"Resuming from checkpoint: {CHECKPOINT_PATH}")
    with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    return [Province.from_dict(p) for p in payload]


def clear_checkpoint() -> None:
    if os.path.exists(CHECKPOINT_PATH):
        os.remove(CHECKPOINT_PATH)


# ---------------------------------------------------------------------------
# YAML emission helpers
# ---------------------------------------------------------------------------

def make_node(
    provider_id: str,
    name: str,
    aliases: list[str],
    children: list[dict] | None = None,
    postal_codes: list[str] | None = None,
) -> dict:
    node: dict[str, Any] = {
        "providerId": provider_id,
        "name": name,
    }
    if aliases:
        node["aliases"] = aliases
    if children is not None:
        node["children"] = children
    if postal_codes is not None:
        node["postalCodes"] = postal_codes
    return node


def emit_yaml(provinces: list[Province]) -> str:
    # Build document
    country_nodes: list[dict] = []
    for prov in sorted(provinces, key=lambda p: int(p.live_id)):
        city_nodes: list[dict] = []
        for city in sorted(prov.cities, key=lambda c: int(c.live_id)):
            district_nodes: list[dict] = []
            for district in sorted(city.districts, key=lambda d: int(d.live_id)):
                subdistrict_nodes: list[dict] = []
                for sub in sorted(district.subdistricts, key=lambda s: int(s.live_id)):
                    subdistrict_nodes.append(
                        make_node(
                            provider_id=sub.live_id,
                            name=sub.name,
                            aliases=[],
                            children=None,
                            postal_codes=sub.postal_codes,
                        )
                    )
                district_nodes.append(
                    make_node(
                        provider_id=f"d{district.live_id}",
                        name=district.name,
                        aliases=[],
                        children=subdistrict_nodes,
                    )
                )
            city_nodes.append(
                make_node(
                    provider_id=f"c{city.live_id}",
                    name=city.name,
                    aliases=city.aliases,
                    children=district_nodes,
                )
            )
        country_nodes.append(
            make_node(
                provider_id=f"p{prov.live_id}",
                name=prov.name,
                aliases=prov.aliases,
                children=city_nodes,
            )
        )

    document = {
        "provider": "rajaongkir",
        "version": "1",
        "countries": [
            {
                "countryCode": "ID",
                "nodes": country_nodes,
            }
        ],
    }

    # Custom representer to force quoted strings where needed
    def str_representer(dumper, data):
        if data.isdigit():
            return dumper.represent_scalar("tag:yaml.org,2002:str", data, style='"')
        return dumper.represent_scalar("tag:yaml.org,2002:str", data)

    yaml.add_representer(str, str_representer)

    return yaml.dump(
        document,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=120,
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_tree(provinces: list[Province]) -> None:
    seen_provider_ids: set[str] = set()

    def check_unique(pid: str, context: str) -> None:
        if pid in seen_provider_ids:
            raise RajaOngkirCrawlError(f"Duplicate providerId '{pid}' at {context}")
        seen_provider_ids.add(pid)

    for prov in provinces:
        check_unique(f"p{prov.live_id}", f"province {prov.name}")
        for city in prov.cities:
            check_unique(f"c{city.live_id}", f"city {city.name} under {prov.name}")
            for district in city.districts:
                check_unique(f"d{district.live_id}", f"district {district.name} under {city.name}")
                for sub in district.subdistricts:
                    check_unique(sub.live_id, f"subdistrict {sub.name} under {district.name}")

    # Structural sanity checks
    if len(provinces) == 0:
        raise RajaOngkirCrawlError("No provinces found")
    for prov in provinces:
        if not prov.cities:
            raise RajaOngkirCrawlError(f"Province {prov.name} has no cities")
        for city in prov.cities:
            if not city.districts:
                raise RajaOngkirCrawlError(f"City {city.name} has no districts")
            for district in city.districts:
                if not district.subdistricts:
                    raise RajaOngkirCrawlError(f"District {district.name} has no subdistricts")


# ---------------------------------------------------------------------------
# Crawl
# ---------------------------------------------------------------------------

def crawl_provinces(api_key: str, checkpoint: list[Province] | None) -> list[Province]:
    if checkpoint is not None and checkpoint:
        print(f"Resuming with {len(checkpoint)} provinces from checkpoint")
        return checkpoint

    print("Fetching provinces…")
    raw_provinces = api_get("/destination/province", api_key)
    provinces: list[Province] = []
    for item in raw_provinces:
        pid = str(item.get("id", "")).strip()
        name = normalize_name(str(item.get("name", "")))
        if not pid or not name:
            raise RajaOngkirCrawlError(f"Malformed province entry: {item}")
        prov = Province(live_id=pid, name=name)
        # Preserve any provider aliases if present
        aliases_raw = item.get("aliases")
        if isinstance(aliases_raw, list):
            prov.aliases = [normalize_name(a) for a in aliases_raw if isinstance(a, str) and a.strip()]
        provinces.append(prov)
    print(f"  → {len(provinces)} provinces")
    save_checkpoint(provinces)
    return provinces


def crawl_cities(provinces: list[Province], api_key: str) -> None:
    total = len(provinces)
    for idx, prov in enumerate(provinces, start=1):
        if prov.cities:
            print(f"[{idx}/{total}] Cities for {prov.name} already in checkpoint, skipping")
            continue
        print(f"[{idx}/{total}] Fetching cities for {prov.name}…")
        raw_cities = api_get(f"/destination/city/{prov.live_id}", api_key)
        for item in raw_cities:
            cid = str(item.get("id", "")).strip()
            name = normalize_name(str(item.get("name", "")))
            if not cid or not name:
                raise RajaOngkirCrawlError(f"Malformed city entry: {item}")
            city_type = str(item.get("type", "")).strip().upper()
            if city_type:
                name = f"{city_type} {name}"
            aliases = build_city_aliases(str(item.get("name", "")), name)
            prov.cities.append(City(live_id=cid, name=name, aliases=aliases))
        save_checkpoint(provinces)
        time.sleep(REQUEST_DELAY_SECONDS)


def crawl_districts(provinces: list[Province], api_key: str) -> None:
    total_provinces = len(provinces)
    for p_idx, prov in enumerate(provinces, start=1):
        total_cities = len(prov.cities)
        for c_idx, city in enumerate(prov.cities, start=1):
            if city.districts:
                print(
                    f"[{p_idx}/{total_provinces}][{c_idx}/{total_cities}] "
                    f"Districts for {city.name} already in checkpoint, skipping"
                )
                continue
            print(
                f"[{p_idx}/{total_provinces}][{c_idx}/{total_cities}] "
                f"Fetching districts for {city.name}…"
            )
            raw_districts = api_get(f"/destination/district/{city.live_id}", api_key)
            for item in raw_districts:
                did = str(item.get("id", "")).strip()
                name = normalize_name(str(item.get("name", "")))
                if not did or not name:
                    raise RajaOngkirCrawlError(f"Malformed district entry: {item}")
                city.districts.append(District(live_id=did, name=name))
            save_checkpoint(provinces)
            time.sleep(REQUEST_DELAY_SECONDS)


def crawl_subdistricts(provinces: list[Province], api_key: str) -> None:
    total_provinces = len(provinces)
    for p_idx, prov in enumerate(provinces, start=1):
        total_cities = len(prov.cities)
        for c_idx, city in enumerate(prov.cities, start=1):
            total_districts = len(city.districts)
            for d_idx, district in enumerate(city.districts, start=1):
                if district.subdistricts:
                    print(
                        f"[{p_idx}/{total_provinces}][{c_idx}/{total_cities}][{d_idx}/{total_districts}] "
                        f"Subdistricts for {district.name} already in checkpoint, skipping"
                    )
                    continue
                print(
                    f"[{p_idx}/{total_provinces}][{c_idx}/{total_cities}][{d_idx}/{total_districts}] "
                    f"Fetching subdistricts for {district.name}…"
                )
                raw_subs = api_get(f"/destination/sub-district/{district.live_id}", api_key)
                for item in raw_subs:
                    sid = str(item.get("id", "")).strip()
                    name = normalize_name(str(item.get("name", "")))
                    if not sid or not name:
                        raise RajaOngkirCrawlError(f"Malformed subdistrict entry: {item}")
                    postal_codes: list[str] = []
                    zip_raw = item.get("zip_code")
                    if isinstance(zip_raw, str) and zip_raw.strip():
                        postal_codes.append(zip_raw.strip())
                    elif isinstance(zip_raw, (int, float)):
                        postal_codes.append(str(int(zip_raw)).strip())
                    district.subdistricts.append(
                        Subdistrict(live_id=sid, name=name, postal_codes=postal_codes)
                    )
                save_checkpoint(provinces)
                time.sleep(REQUEST_DELAY_SECONDS)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    api_key = get_api_key()
    print(f"Using API key: {mask_key(api_key)}")
    print(f"Output path: {OUTPUT_PATH}")
    print(f"Checkpoint path: {CHECKPOINT_PATH}")

    checkpoint = load_checkpoint()

    provinces = crawl_provinces(api_key, checkpoint)
    crawl_cities(provinces, api_key)
    crawl_districts(provinces, api_key)
    crawl_subdistricts(provinces, api_key)

    print("Validating tree…")
    validate_tree(provinces)

    print("Generating YAML…")
    yaml_text = emit_yaml(provinces)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(yaml_text)

    clear_checkpoint()
    print(f"Done. Wrote {len(yaml_text)} bytes to {OUTPUT_PATH}")
    print("Checkpoint cleared.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
