import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("VeriDiploma System Tests", function () {
  let diploma: any;
  let admin: any, dean: any, rector: any, student: any, attacker: any;

  beforeEach(async function () {
    [admin, dean, rector, student, attacker] = await ethers.getSigners();
    const VeriDiploma = await ethers.getContractFactory("VeriDiploma");
    diploma = await VeriDiploma.deploy(admin.address, dean.address, rector.address);
    await diploma.waitForDeployment();
  });

  it("1. Декан может создать проект диплома (Pending)", async function () {
    const tx = await diploma.connect(dean).proposeDiploma(
      student.address,
      "Иванов Иван Иванович",
      "Прикладная информатика",
      2026
    );
    await tx.wait();

    const d = await diploma.diplomas(1);
    expect(d.studentName).to.equal("Иванов Иван Иванович");
    expect(d.status).to.equal(0n); // 0 = Pending
  });

  it("2. Неавторизованный адрес не может создать диплом", async function () {
    await expect(
      diploma.connect(attacker).proposeDiploma(student.address, "Хакер", "Взлом", 2026)
    ).to.be.revertedWithCustomError(diploma, "AccessControlUnauthorizedAccount");
  });

  it("3. Ректор утверждает диплом, токен выпускается студенту", async function () {
    await diploma.connect(dean).proposeDiploma(student.address, "Иванов Иван", "Информатика", 2026);
    
    await expect(diploma.connect(rector).approveDiploma(1))
      .to.emit(diploma, "DiplomaIssued")
      .withArgs(1n, student.address);

    expect(await diploma.ownerOf(1)).to.equal(student.address);
    const d = await diploma.diplomas(1);
    expect(d.status).to.equal(1n); // 1 = Active
  });

  it("4. Soulbound защита: студент не может передать диплом", async function () {
    await diploma.connect(dean).proposeDiploma(student.address, "Иванов Иван", "Информатика", 2026);
    await diploma.connect(rector).approveDiploma(1);

    await expect(
      diploma.connect(student).transferFrom(student.address, attacker.address, 1)
    ).to.be.revertedWithCustomError(diploma, "DiplomaIsSoulbound");
  });

  it("5. Ректор может аннулировать диплом с указанием причины", async function () {
    await diploma.connect(dean).proposeDiploma(student.address, "Иванов Иван", "Информатика", 2026);
    await diploma.connect(rector).approveDiploma(1);

    await expect(diploma.connect(rector).revokeDiploma(1, "Обнаружен плагиат в ВКР"))
      .to.emit(diploma, "DiplomaRevoked")
      .withArgs(1n, "Обнаружен плагиат в ВКР");

    const d = await diploma.diplomas(1);
    expect(d.status).to.equal(2n); // 2 = Revoked
    expect(d.revocationReason).to.equal("Обнаружен плагиат в ВКР");
  });

  it("6. Генерация валидного tokenURI c Base64 SVG", async function () {
    await diploma.connect(dean).proposeDiploma(student.address, "Иванов Иван", "Информатика", 2026);
    await diploma.connect(rector).approveDiploma(1);

    const uri = await diploma.tokenURI(1);
    expect(uri).to.include("data:application/json;base64,");
  });
});