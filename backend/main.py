import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from web3 import Web3

from database import SessionLocal, init_db, DiplomaRecord

RPC_URL = "http://127.0.0.1:8545"
CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
ARTIFACT_PATH = "../contracts/artifacts/contracts/VeriDiploma.sol/VeriDiploma.json"

w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Загрузка ABI
try:
    with open(ARTIFACT_PATH, "r", encoding="utf-8") as f:
        artifact = json.load(f)
        ABI = artifact["abi"]
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)
except Exception as e:
    print(f"Внимание: не удалось загрузить ABI/контракт: {e}")
    contract = None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def sync_blockchain_events():
    """Фоновый синк событий смарт-контракта в SQLite"""
    while True:
        if contract and w3.is_connected():
            try:
                db = SessionLocal()
                # 1. Ловим DiplomaProposed
                proposed_events = contract.events.DiplomaProposed.get_logs(from_block=0)
                for ev in proposed_events:
                    args = ev["args"]
                    rec = db.query(DiplomaRecord).filter_by(token_id=args["tokenId"]).first()
                    if not rec:
                        # Читаем детали из контракта
                        d = contract.functions.diplomas(args["tokenId"]).call()
                        new_rec = DiplomaRecord(
                            token_id=d[0],
                            student_name=d[1],
                            major=d[2],
                            graduation_year=d[3],
                            status="Pending" if d[4] == 0 else ("Active" if d[4] == 1 else "Revoked"),
                            revocation_reason=d[5],
                            student_address=d[6]
                        )
                        db.add(new_rec)
                        db.commit()

                # 2. Ловим DiplomaIssued
                issued_events = contract.events.DiplomaIssued.get_logs(from_block=0)
                for ev in issued_events:
                    t_id = ev["args"]["tokenId"]
                    rec = db.query(DiplomaRecord).filter_by(token_id=t_id).first()
                    if rec and rec.status != "Revoked":
                        rec.status = "Active"
                        db.commit()

                # 3. Ловим DiplomaRevoked
                revoked_events = contract.events.DiplomaRevoked.get_logs(from_block=0)
                for ev in revoked_events:
                    t_id = ev["args"]["tokenId"]
                    reason = ev["args"]["reason"]
                    rec = db.query(DiplomaRecord).filter_by(token_id=t_id).first()
                    if rec:
                        rec.status = "Revoked"
                        rec.revocation_reason = reason
                        db.commit()
                db.close()
            except Exception as ex:
                print(f"Ошибка синка: {ex}")
        await asyncio.sleep(2)  # Проверяем сеть каждые 2 секунды

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(sync_blockchain_events())
    yield

app = FastAPI(title="VeriDiploma API", lifespan=lifespan)

# Разрешаем CORS, чтобы фронтенд мог слать запросы
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/diplomas")
def get_diplomas(status: str = Query(None), db: Session = Depends(get_db)):
    query = db.query(DiplomaRecord)
    if status:
        query = query.filter(DiplomaRecord.status == status)
    return query.order_by(DiplomaRecord.token_id.desc()).all()

@app.get("/api/diplomas/{token_id}")
def get_diploma(token_id: int, db: Session = Depends(get_db)):
    rec = db.query(DiplomaRecord).filter_by(token_id=token_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Диплом не найден")
    return rec

@app.get("/api/search")
def search_diplomas(q: str = Query(...), db: Session = Depends(get_db)):
    query = db.query(DiplomaRecord).filter(
        (DiplomaRecord.student_name.ilike(f"%{q}%")) | 
        (DiplomaRecord.student_address.ilike(f"%{q}%"))
    )
    return query.all()

@app.get("/api/contract-info")
def get_contract_info():
    return {
        "address": CONTRACT_ADDRESS,
        "rpcUrl": RPC_URL,
        "abi": ABI if contract else []
    }