#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${PROJECT_ROOT}/.venv"

if [[ -n "${VCP_PYTHON_EXECUTABLE:-}" ]]; then
  BASE_PYTHON="${VCP_PYTHON_EXECUTABLE}"
elif command -v python3 >/dev/null 2>&1; then
  BASE_PYTHON="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  BASE_PYTHON="$(command -v python)"
else
  echo "No Python interpreter found (checked VCP_PYTHON_EXECUTABLE, python3, python)." >&2
  exit 1
fi

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  "${BASE_PYTHON}" -m venv "${VENV_DIR}"
fi

VENV_PYTHON="${VENV_DIR}/bin/python"
FALLBACK_INDEX_URL="${VCP_PYTHON_FALLBACK_INDEX_URL:-https://pypi.org/simple}"

pip_install() {
  if "${VENV_PYTHON}" -m pip install "$@"; then
    return 0
  fi
  echo "Primary pip index failed; retrying with ${FALLBACK_INDEX_URL}" >&2
  "${VENV_PYTHON}" -m pip install --index-url "${FALLBACK_INDEX_URL}" "$@"
}

pip_install --upgrade pip setuptools wheel

REQUIREMENT_FILES=(
  "${PROJECT_ROOT}/requirements.txt"
  "${PROJECT_ROOT}/Plugin/ArtistMatcher/requirements.txt"
  "${PROJECT_ROOT}/Plugin/DigitalOracle/requirements.txt"
  "${PROJECT_ROOT}/Plugin/SciCalculator/requirements.txt"
  "${PROJECT_ROOT}/Plugin/VideoGenerator/requirements.txt"
)

for requirement_file in "${REQUIREMENT_FILES[@]}"; do
  if [[ ! -f "${requirement_file}" ]]; then
    echo "Missing required dependency file: ${requirement_file}" >&2
    exit 1
  fi
  pip_install -r "${requirement_file}"
done

"${VENV_PYTHON}" -c 'import numpy, requests, scipy, sympy; from PIL import Image; print("VCP Python runtime ready")'
