#!/bin/bash
cd backend
python -m venv .venv
#source .venv/bin/activate  
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000


