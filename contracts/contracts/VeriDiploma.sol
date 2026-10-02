// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

error DiplomaIsSoulbound();
error DiplomaNotFound();
error InvalidDiplomaStatus();
error EmptyReason();

contract VeriDiploma is ERC721, AccessControl {
    using Strings for uint256;
    using Strings for uint16;

    bytes32 public constant DEAN_ROLE = keccak256("DEAN_ROLE");
    bytes32 public constant RECTOR_ROLE = keccak256("RECTOR_ROLE");

    enum DiplomaStatus {
        Pending,
        Active,
        Revoked
    }

    struct Diploma {
        uint256 tokenId;
        string studentName;
        string major;
        uint16 graduationYear;
        DiplomaStatus status;
        string revocationReason;
        address studentAddress;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => Diploma) public diplomas;

    event DiplomaProposed(uint256 indexed tokenId, address indexed student, string studentName);
    event DiplomaIssued(uint256 indexed tokenId, address indexed student);
    event DiplomaRevoked(uint256 indexed tokenId, string reason);

    constructor(address defaultAdmin, address initialDean, address initialRector)
        ERC721("VeriDiploma", "VDIP")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(DEAN_ROLE, initialDean);
        _grantRole(RECTOR_ROLE, initialRector);
    }

    // --- БИЗНЕС-ЛОГИКА ---

    /// @notice Деканат создает заявку
    function proposeDiploma(
        address student,
        string calldata name,
        string calldata major,
        uint16 year
    ) external onlyRole(DEAN_ROLE) returns (uint256) {
        require(student != address(0), "Zero address");

        uint256 tokenId = _nextTokenId++;

        diplomas[tokenId] = Diploma({
            tokenId: tokenId,
            studentName: name,
            major: major,
            graduationYear: year,
            status: DiplomaStatus.Pending,
            revocationReason: "",
            studentAddress: student
        });

        emit DiplomaProposed(tokenId, student, name);
        return tokenId;
    }

    /// @notice Ректорат утверждает выпуск и передает токен студенту
    function approveDiploma(uint256 tokenId) external onlyRole(RECTOR_ROLE) {
        Diploma storage d = diplomas[tokenId];
        if (d.tokenId == 0) revert DiplomaNotFound();
        if (d.status != DiplomaStatus.Pending) revert InvalidDiplomaStatus();

        d.status = DiplomaStatus.Active;
        _safeMint(d.studentAddress, tokenId);

        emit DiplomaIssued(tokenId, d.studentAddress);
    }

    /// @notice Ректорат аннулирует диплом за нарушения
    function revokeDiploma(uint256 tokenId, string calldata reason) external onlyRole(RECTOR_ROLE) {
        if (bytes(reason).length == 0) revert EmptyReason();
        Diploma storage d = diplomas[tokenId];
        if (d.tokenId == 0) revert DiplomaNotFound();
        if (d.status != DiplomaStatus.Active) revert InvalidDiplomaStatus();

        d.status = DiplomaStatus.Revoked;
        d.revocationReason = reason;

        emit DiplomaRevoked(tokenId, reason);
    }

    // --- SOULBOUND ЗАЩИТА ---

    function transferFrom(address, address, uint256) public virtual override {
        revert DiplomaIsSoulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override {
        revert DiplomaIsSoulbound();
    }

    function approve(address, uint256) public virtual override {
        revert DiplomaIsSoulbound();
    }

    function setApprovalForAll(address, bool) public virtual override {
        revert DiplomaIsSoulbound();
    }

    // --- ON-CHAIN SVG И METADATA ---

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        Diploma memory d = diplomas[tokenId];
        if (d.tokenId == 0) revert DiplomaNotFound();

        string memory svgImage = _generateSVG(d);
        string memory imageUri = string(
            abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svgImage)))
        );

        string memory statusStr = d.status == DiplomaStatus.Pending
            ? "Pending"
            : (d.status == DiplomaStatus.Active ? "Active" : "Revoked");

        string memory json = Base64.encode(
            bytes(
                abi.encodePacked(
                    '{"name": "VeriDiploma #', tokenId.toString(),
                    '", "description": "Academic Soulbound Diploma verified by University Authority", ',
                    '"attributes": [',
                        '{"trait_type": "Student", "value": "', d.studentName, '"},',
                        '{"trait_type": "Major", "value": "', d.major, '"},',
                        '{"trait_type": "Year", "value": "', uint256(d.graduationYear).toString(), '"},',
                        '{"trait_type": "Status", "value": "', statusStr, '"}',
                    '], ',
                    '"image": "', imageUri, '"}'
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _generateSVG(Diploma memory d) internal pure returns (string memory) {
        string memory revocationStamp = "";
        if (d.status == DiplomaStatus.Revoked) {
            revocationStamp = string(
                abi.encodePacked(
                    '<g transform="rotate(-15 300 200)">',
                    '<rect x="60" y="150" width="480" height="90" fill="#dc2626" opacity="0.88" rx="8" />',
                    '<text x="300" y="195" font-family="Arial" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">REVOKED / ANNULLIROVANO</text>',
                    '<text x="300" y="225" font-family="Arial" font-size="14" fill="#ffffff" text-anchor="middle">Reason: ', d.revocationReason, '</text>',
                    '</g>'
                )
            );
        }

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">',
                '<defs>',
                '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" stop-color="#0f172a"/>',
                '<stop offset="100%" stop-color="#1e293b"/>',
                '</linearGradient>',
                '</defs>',
                '<rect width="100%" height="100%" fill="url(#bg)"/>',
                '<rect x="20" y="20" width="560" height="360" rx="12" fill="none" stroke="#38bdf8" stroke-width="2"/>',
                '<text x="300" y="70" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#38bdf8" text-anchor="middle">STATE UNIVERSITY OF TECHNOLOGY</text>',
                '<text x="300" y="105" font-family="Arial, sans-serif" font-size="14" letter-spacing="4" fill="#94a3b8" text-anchor="middle">OFFICIAL DIPLOMA OF HIGHER EDUCATION</text>',
                '<line x1="100" y1="125" x2="500" y2="125" stroke="#334155" stroke-width="1"/>',
                '<text x="300" y="170" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#f8fafc" text-anchor="middle">', d.studentName, '</text>',
                '<text x="300" y="215" font-family="Arial, sans-serif" font-size="16" fill="#cbd5e1" text-anchor="middle">Specialty: ', d.major, '</text>',
                '<text x="300" y="245" font-family="Arial, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">Class of ', uint256(d.graduationYear).toString(), '</text>',
                '<text x="300" y="340" font-family="monospace" font-size="11" fill="#475569" text-anchor="middle">Token ID: #', d.tokenId.toString(), ' | Non-Transferable Soulbound Asset</text>',
                revocationStamp,
                '</svg>'
            )
        );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}