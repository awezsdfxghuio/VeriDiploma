import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contractConfig";

function parseContractError(err, contractInstance) {
  const data =
    err?.data ||
    err?.error?.data ||
    err?.info?.error?.data ||
    err?.payload?.params?.[0]?.data;

  if (data && contractInstance) {
    try {
      const parsed = contractInstance.interface.parseError(data);
      if (parsed) {
        if (parsed.name === "AccessControlUnauthorizedAccount") {
          return "Ошибка доступа: У вашего аккаунта нет необходимых прав для этого действия (требуется роль Ректора/Декана)!";
        }
        if (parsed.name === "DiplomaNotFound") {
          return "Диплом с таким ID не существует!";
        }
        if (parsed.name === "InvalidDiplomaStatus") {
          return "Недопустимый статус диплома для этой операции!";
        }
        if (parsed.name === "DiplomaIsSoulbound") {
          return "Soulbound блокировка: Академический диплом нельзя передавать другому лицу!";
        }
        if (parsed.name === "EmptyReason") {
          return "Необходимо обязательно указать причину аннулирования!";
        }
        return `Ошибка контракта: ${parsed.name}`;
      }
    } catch {}
  }
  return err?.reason || err?.shortMessage || err?.message || "Непредвиденная ошибка транзакции.";
}

// -------------------------------------------------------------
// 1. ПУБЛИЧНЫЙ ПОРТАЛ ВЕРИФИКАЦИИ (ГЛАВНАЯ СТРАНИЦА /)
// -------------------------------------------------------------
function PublicVerifier() {
  const [searchId, setSearchId] = useState("");
  const [diplomaData, setDiplomaData] = useState(null);
  const [diplomaSvg, setDiplomaSvg] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleVerify = async () => {
    if (!searchId) return;
    try {
      setVerifyLoading(true);
      setDiplomaData(null);
      setDiplomaSvg(null);

      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const d = await readContract.diplomas(searchId);
      if (d.tokenId === 0n) {
        alert("Диплом с таким идентификатором не найден в реестре!");
        return;
      }

      const statusMap = ["Pending (На согласовании)", "Active (Действителен)", "Revoked (Аннулирован)"];
      setDiplomaData({
        tokenId: d.tokenId.toString(),
        name: d.studentName,
        major: d.major,
        year: d.graduationYear.toString(),
        statusText: statusMap[d.status],
        statusCode: Number(d.status),
        reason: d.revocationReason,
        student: d.studentAddress,
      });

      try {
        const uri = await readContract.tokenURI(searchId);
        const base64Json = uri.replace("data:application/json;base64,", "");
        const parsedMetadata = JSON.parse(atob(base64Json));
        setDiplomaSvg(parsedMetadata.image);
      } catch {
        console.log("SVG недоступен или статус Pending");
      }
    } catch (err) {
      alert("Ошибка при проверке реестра: " + err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Государственный реестр академических дипломов
        </h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Публичная децентрализованная система мгновенной проверки подлинности дипломов на базе блокчейна. Подключение кошелька не требуется.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex gap-3">
          <input
            type="number"
            placeholder="Введите уникальный номер диплома (например, 1)"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 text-white placeholder-slate-500"
          />
          <button
            onClick={handleVerify}
            disabled={verifyLoading}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white px-8 py-3 rounded-xl text-sm font-semibold transition"
          >
            {verifyLoading ? "Поиск..." : "Проверить"}
          </button>
        </div>
      </div>

      {diplomaData && (
        <div className="border border-slate-800 bg-slate-900/90 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Идентификатор</span>
              <h3 className="font-bold text-xl text-white">Диплом #{diplomaData.tokenId}</h3>
            </div>
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${
                diplomaData.statusCode === 1
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : diplomaData.statusCode === 2
                  ? "bg-red-950 text-red-400 border border-red-800"
                  : "bg-amber-950 text-amber-400 border border-amber-800"
              }`}
            >
              {diplomaData.statusText}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Выпускник</span>
              <span className="text-slate-200 font-medium">{diplomaData.name}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Направление подготовки</span>
              <span className="text-slate-200 font-medium">{diplomaData.major}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Год выпуска</span>
              <span className="text-slate-200 font-medium">{diplomaData.year}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-500 block">Кошелек владельца (Soulbound)</span>
              <span className="font-mono text-slate-300 text-xs">
                {diplomaData.student.slice(0, 10)}...{diplomaData.student.slice(-6)}
              </span>
            </div>
          </div>

          {diplomaData.reason && (
            <div className="p-4 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300">
              <strong className="block mb-1 font-semibold">Основание аннулирования:</strong>
              {diplomaData.reason}
            </div>
          )}

          {diplomaSvg && (
            <div className="pt-2 flex flex-col items-center">
              <span className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">
                Подлинный бланк из блокчейна (On-Chain SVG)
              </span>
              <img
                src={diplomaSvg}
                alt="Диплом"
                className="w-full max-w-lg rounded-xl border border-slate-800 shadow-2xl"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 2. СЛУЖЕБНЫЙ КАБИНЕТ УНИВЕРСИТЕТА (/admin)
// -------------------------------------------------------------
function UniversityAdmin({ account, contract }) {
  const [adminTab, setAdminTab] = useState("dean");

  // Деканат
  const [deanForm, setDeanForm] = useState({
    student: "",
    name: "",
    major: "Прикладная информатика",
    year: 2026,
  });
  const [deanLoading, setDeanLoading] = useState(false);

  // Ректорат
  const [pendingDiplomas, setPendingDiplomas] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [rectorTokenId, setRectorTokenId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rectorLoading, setRectorLoading] = useState(false);

  // Загрузка очереди дипломов со статусом Pending (0)
  const fetchPendingDiplomas = async () => {
    try {
      setListLoading(true);
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const items = [];
      // Сканируем первые 50 ID для демонстрации
      for (let i = 1; i <= 50; i++) {
        try {
          const d = await readContract.diplomas(i);
          if (d.tokenId === 0n) break; // Больше дипломов нет
          if (Number(d.status) === 0) {
            // Статус Pending
            items.push({
              id: d.tokenId.toString(),
              name: d.studentName,
              major: d.major,
              year: d.graduationYear.toString(),
              student: d.studentAddress,
            });
          }
        } catch {
          break;
        }
      }
      setPendingDiplomas(items);
    } catch (e) {
      console.error("Ошибка загрузки очереди:", e);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (adminTab === "rector") {
      fetchPendingDiplomas();
    }
  }, [adminTab]);

  const handlePropose = async (e) => {
    e.preventDefault();
    if (!contract) return alert("Сначала подключите кошелек сотрудника вверху страницы!");
    try {
      setDeanLoading(true);
      const tx = await contract.proposeDiploma(
        deanForm.student,
        deanForm.name,
        deanForm.major,
        Number(deanForm.year)
      );
      await tx.wait();
      alert("Проект диплома успешно зарегистрирован в блокчейне!");
      setDeanForm({ student: "", name: "", major: "Прикладная информатика", year: 2026 });
    } catch (err) {
      alert(parseContractError(err, contract));
    } finally {
      setDeanLoading(false);
    }
  };

  const handleApprove = async (idToApprove) => {
    const id = idToApprove || rectorTokenId;
    if (!contract) return alert("Сначала подключите кошелек сотрудника вверху страницы!");
    if (!id) return alert("Укажите номер диплома!");
    try {
      setActionLoadingId(id);
      setRectorLoading(true);
      const tx = await contract.approveDiploma(id);
      await tx.wait();
      alert(`Диплом #${id} успешно утвержден и отправлен студенту!`);
      if (rectorTokenId === id) setRectorTokenId("");
      await fetchPendingDiplomas();
    } catch (err) {
      alert(parseContractError(err, contract));
    } finally {
      setActionLoadingId(null);
      setRectorLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!contract) return alert("Сначала подключите кошелек сотрудника вверху страницы!");
    if (!rectorTokenId) return alert("Укажите ID диплома для отзыва!");
    if (!revokeReason) return alert("Укажите причину аннулирования!");
    try {
      setRectorLoading(true);
      const tx = await contract.revokeDiploma(rectorTokenId, revokeReason);
      await tx.wait();
      alert(`Диплом #${rectorTokenId} аннулирован приказом ректората!`);
      setRectorTokenId("");
      setRevokeReason("");
      await fetchPendingDiplomas();
    } catch (err) {
      alert(parseContractError(err, contract));
    } finally {
      setRectorLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white">Панель управления университетом</h2>
        <p className="text-xs text-slate-400">Служебный доступ для сотрудников деканата и ректората</p>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => setAdminTab("dean")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
            adminTab === "dean" ? "bg-sky-600 text-white shadow-lg" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
        >
          🏛 Кабинет Деканата (Создание)
        </button>
        <button
          onClick={() => setAdminTab("rector")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
            adminTab === "rector" ? "bg-sky-600 text-white shadow-lg" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
        >
          👑 Кабинет Ректората (Очередь на подпись)
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {adminTab === "dean" && (
          <form onSubmit={handlePropose} className="space-y-4">
            <h3 className="text-base font-semibold text-slate-200 pb-2 border-b border-slate-800">
              Формирование проекта диплома (DEAN_ROLE)
            </h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Адрес кошелька студента</label>
              <input
                type="text"
                placeholder="0x..."
                required
                value={deanForm.student}
                onChange={(e) => setDeanForm({ ...deanForm, student: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">ФИО Студента</label>
              <input
                type="text"
                placeholder="Иванов Иван Иванович"
                required
                value={deanForm.name}
                onChange={(e) => setDeanForm({ ...deanForm, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Специальность</label>
                <input
                  type="text"
                  required
                  value={deanForm.major}
                  onChange={(e) => setDeanForm({ ...deanForm, major: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Год выпуска</label>
                <input
                  type="number"
                  required
                  value={deanForm.year}
                  onChange={(e) => setDeanForm({ ...deanForm, year: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={deanLoading}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition mt-3"
            >
              {deanLoading ? "Отправка в сеть..." : "Сформировать приказ (Propose)"}
            </button>
          </form>
        )}

        {adminTab === "rector" && (
          <div className="space-y-6">
            {/* Очередь на утверждение */}
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                <h3 className="text-base font-semibold text-slate-200">
                  Очередь на подписание (Pending)
                </h3>
                <button
                  onClick={fetchPendingDiplomas}
                  disabled={listLoading}
                  className="text-xs text-sky-400 hover:text-sky-300 transition"
                >
                  {listLoading ? "Обновление..." : "🔄 Обновить список"}
                </button>
              </div>

              {pendingDiplomas.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  🎉 Нет дипломов, ожидающих визирования. Все заявки подписаны!
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingDiplomas.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sky-400 text-sm">#{item.id}</span>
                          <span className="font-semibold text-white text-sm">{item.name}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {item.major} • {item.year} г. • <span className="font-mono text-slate-500">{item.student.slice(0, 6)}...{item.student.slice(-4)}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoadingId === item.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shrink-0"
                      >
                        {actionLoadingId === item.id ? "Подписание..." : "Утвердить в 1 клик"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Аннулирование / Ручной ввод */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-sm font-semibold text-red-400">
                Аннулирование диплома (Revoke)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  placeholder="ID диплома"
                  value={rectorTokenId}
                  onChange={(e) => setRectorTokenId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="Причина (например, Плагиат)"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="col-span-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white"
                />
              </div>
              <button
                onClick={handleRevoke}
                disabled={rectorLoading || !rectorTokenId}
                className="w-full bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Отозвать диплом (Revoke)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ШАПКА
// -------------------------------------------------------------
function Header({ account, connectWallet }) {
  const location = useLocation();
  const isAdmin = location.pathname === "/admin";

  return (
    <header className="w-full max-w-3xl flex justify-between items-center pb-6 mb-8 border-b border-slate-800">
      <div>
        <h1 className="text-2xl font-bold text-sky-400 tracking-tight">🎓 VeriDiploma</h1>
        <p className="text-xs text-slate-500">
          {isAdmin ? "Служебный шлюз университета" : "SBT Academic Verification Network"}
        </p>
      </div>

      {isAdmin && (
        <div>
          {account ? (
            <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg font-mono text-emerald-400">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          ) : (
            <button
              onClick={connectWallet}
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md"
            >
              Подключить MetaMask
            </button>
          )}
        </div>
      )}
    </header>
  );
}

// -------------------------------------------------------------
// ГЛАВНОЕ ПРИЛОЖЕНИЕ С МАРШРУТАМИ
// -------------------------------------------------------------
export default function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Пожалуйста, установите MetaMask!");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setAccount(addr);
      setContract(contractInstance);
    } catch (err) {
      alert("Ошибка подключения: " + err.message);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6">
        <Header account={account} connectWallet={connectWallet} />
        <Routes>
          <Route path="/" element={<PublicVerifier />} />
          <Route
            path="/admin"
            element={
              <UniversityAdmin
                account={account}
                contract={contract}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}