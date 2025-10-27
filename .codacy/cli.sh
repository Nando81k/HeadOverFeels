#!/bin/bash
docker run --rm -v "$PWD":/code codacy/codacy-analysis-cli:latest "$@"
