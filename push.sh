#!/bin/bash

# Check if a commit message was provided
if [ -z "$1" ]; then
  echo "Usage: ./push.sh \"Your commit message\" [\"Optional description\"]"
  exit 1
fi

# Add all changes
git add .

# Commit with the title ($1) and, if provided, a description ($2) as the body
if [ -n "$2" ]; then
  git commit -m "$1" -m "$2"
else
  git commit -m "$1"
fi

# Push to origin
git push
