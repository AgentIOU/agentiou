// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title AgentIOU: a pay-later ledger for Agent ID holders on BNB Smart Chain
/// @notice Owner powers: none. There is no owner, no upgrade, no pause and no fee.
///         The contract never holds anyone's money: a repayment goes straight from the debtor to the creditor.
///         A shop loan goes straight from the shop's wallet to the borrower, out of an approval the shop set itself.
///         The only balance it can hold is BNB that could not be delivered to a creditor, kept under that
///         creditor's name until they call withdraw().
///         Nothing here moves money by itself: no scheduled collection, no automatic or bundled transfer.
interface IAgentId { function balanceOf(address owner) external view returns (uint256); }
interface IFeed { function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80); }

contract AgentIOU {
    // ---- fixed addresses on BNB Smart Chain (constants, so there is nothing to configure or change)
    address public constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F; // SPACE ID Agent ID, ERC-721, non-transferable
    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;     // BSC-USD, 18 decimals
    address public constant BNB_USD_FEED = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE; // Chainlink BNB/USD, 8 decimals

    uint8 public constant BNB = 0;
    uint8 public constant TOKEN_USDT = 1;
    enum Status { Pending, Active, Repaid, Declined, Cancelled }

    uint256 public constant MAX_ACTIVE_DEBTS = 10;
    uint256 public constant MAX_PENDING_SENT = 20;
    uint256 public constant GRACE = 7 days;        // late up to here; after it, a default
    uint256 public constant PRICE_MAX_AGE = 1 days;
    uint256 internal constant FOUNDERS = 3;         // designs 1-3: Promise Mart Founders stickers
    uint256 public constant DESIGNS = 12;           // designs 4-12: Season 1 (Common 4-6, Rare 7-9, Legendary 10-12)

    /// @notice The shop that may attach a Founders sticker to its offers. It is the deploying address and has
    ///         no other right: it cannot change rules, touch balances or act for anyone.
    address public immutable MART;

    struct User {
        uint40 joinedAt; uint32 no;
        uint16 onTime; uint16 late; uint16 defaults; uint16 people;
        uint16 good;                    // on-time repays counted toward the level; a late repay cuts it
        uint32 owedCents; uint32 xp; uint8 badges;
        uint16[3] claimed; uint16[3] pocket;
        uint32 checkDay; uint8 checkDays;
        uint32 xpDay; uint8 repayXpToday; uint8 backXpToday; uint8 takesToday;   // counters for the current UTC day (xpDay)
        string nickname;
    }
    struct Iou {
        address creditor; address debtor; uint8 asset; Status status;
        uint40 createdAt; uint40 dueAt; uint40 repaidAt; uint32 usdCents; uint32 offerId;
        uint256 amount; string memo;
    }
    struct Offer {
        address shop; uint8 asset; bool active; uint16 termDays; uint32 stock; uint32 taken; uint8 designId;
        uint256 price; string title;
    }
    struct Mint { uint32 edition; uint64 blockNo; uint40 time; }

    mapping(address => User) internal users;
    address[] public members;
    Iou[] internal ious;            // id = index + 1
    Offer[] internal offers;        // id = index + 1
    mapping(address => uint256[]) internal iousOf;
    mapping(address => uint256[]) internal activeDebts;
    mapping(address => uint256) public pendingSent;
    mapping(address => mapping(address => bool)) public met;      // debtor => creditor: finished an IOU together
    mapping(address => uint256) public credits;                   // BNB that could not be delivered
    mapping(address => mapping(uint256 => Mint)) internal mints;  // owner => design
    uint32[13] public minted;       // per design
    uint32 public repaidOnTime; uint32 public activeCount; uint32 public stickersMinted;
    string internal baseUri;        // set once at deploy; there is no setter
    uint256 private lock = 1;

    // ---- ERC-1155 events (stickers are soulbound: they can be minted, never moved)
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event URI(string value, uint256 indexed id);
    // ---- ledger events (for reading on BscScan; the site reads view functions)
    event Joined(address indexed user, uint32 no, string nickname);
    event OfferCreated(uint256 indexed offerId, address indexed shop);
    event OfferClosed(uint256 indexed offerId);
    event IouCreated(uint256 indexed id, address indexed creditor, address indexed debtor, uint8 asset, uint256 amount, uint40 dueAt);
    event IouAccepted(uint256 indexed id);
    event IouDeclined(uint256 indexed id);
    event IouCancelled(uint256 indexed id);
    event IouRepaid(uint256 indexed id, address indexed debtor, address indexed creditor, uint256 amount, bool onTime);
    event CheckedIn(address indexed user, uint32 day);
    event VoucherClaimed(address indexed user, uint8 tier);
    event Withdrawn(address indexed to, uint256 amount);

    error NotAgentIdHolder(); error AlreadyJoined(); error NotJoined(); error BadNickname();
    error BadAmount(); error BadDays(); error BadMemo(); error BadAsset(); error BadDesign(); error SelfIou();
    error NotCreditor(); error NotDebtor(); error WrongStatus(); error Expired();
    error OverLimit(); error Restricted(); error Overdue(); error TooManyActive(); error TooManyPending();
    error WrongAmount(); error StalePrice(); error TransferFailed();
    error SoldOut(); error NotShop(); error DailyLimit(); error AlreadyHeld(); error NoVoucher(); error NotEnoughXp(); error AlreadyCheckedIn();
    error Soulbound(); error NothingToWithdraw(); error Reentered();

    modifier nonReentrant() { if (lock != 1) revert Reentered(); lock = 2; _; lock = 1; }

    constructor(string memory metadataBaseUri) { MART = msg.sender; baseUri = metadataBaseUri; }

    // =========================================================== joining
    function join(string calldata nickname) external {
        if (IAgentId(AGENT_ID).balanceOf(msg.sender) == 0) revert NotAgentIdHolder();
        User storage u = users[msg.sender];
        if (u.joinedAt != 0) revert AlreadyJoined();
        _checkNickname(nickname);
        members.push(msg.sender);
        u.joinedAt = uint40(block.timestamp); u.no = uint32(members.length);
        u.nickname = nickname; u.xp = 50; u.badges = 1;
        emit Joined(msg.sender, u.no, nickname);
    }
    function setNickname(string calldata nickname) external { _checkNickname(nickname); _joined(msg.sender).nickname = nickname; }

    // =========================================================== shop offers
    /// @notice Any member can open a shop. A shop lends its own USDT: when an offer is taken, `price` moves from the shop's wallet
    ///         to the borrower (the shop must hold it and have approved this contract for it), and comes back when the IOU is repaid.
    ///         Only MART's offers can carry a Founders sticker (designId 1-3); others pass 0.
    function createOffer(string calldata title, uint8 asset, uint256 price, uint16 termDays, uint32 stock, uint8 designId) external returns (uint256 id) {
        if (asset != TOKEN_USDT) revert BadAsset();   // shop loans are in USDT: the contract can pass USDT from the shop to the borrower, but never holds BNB for anyone
        if (price == 0 || stock == 0) revert BadAmount();
        if (termDays == 0 || termDays > 30) revert BadDays();
        if (bytes(title).length == 0 || bytes(title).length > 48) revert BadMemo();
        if (msg.sender != MART) _joined(msg.sender);   // a shop is the deployer's Promise Mart or an IOU Verified member
        if (designId != 0 && (designId > FOUNDERS || msg.sender != MART)) revert BadDesign();
        offers.push(Offer(msg.sender, asset, true, termDays, stock, 0, designId, price, title));
        id = offers.length; emit OfferCreated(id, msg.sender);
    }
    function closeOffer(uint256 offerId) external {
        Offer storage o = _offer(offerId);
        if (o.shop != msg.sender) revert NotShop();
        o.active = false; emit OfferClosed(offerId);
    }
    /// @notice The shop can add stock to its own offer when it runs out.
    function restock(uint256 offerId, uint32 extra) external {
        Offer storage o = _offer(offerId);
        if (o.shop != msg.sender) revert NotShop();
        o.stock += extra; o.active = true;
    }
    /// @notice Take an offer: the shop's USDT comes to you now, with the sticker if the offer has one, and the IOU is due termDays from now.
    ///         A wallet can take two shop loans a day. Repaying puts the place back in stock.
    function takeOffer(uint256 offerId) external returns (uint256 id) {
        Offer storage o = _offer(offerId);
        if (!o.active || o.taken >= o.stock) revert SoldOut();
        if (o.shop == msg.sender) revert SelfIou();
        uint32 cents = _toCents(o.asset, o.price);
        _checkCanBorrow(msg.sender, cents);
        User storage b = _today(msg.sender);
        if (b.takesToday >= 2) revert DailyLimit();
        b.takesToday++;
        o.taken++;
        ious.push(Iou(o.shop, msg.sender, o.asset, Status.Active, uint40(block.timestamp), uint40(block.timestamp + uint256(o.termDays) * 1 days), 0, cents, uint32(offerId), o.price, o.title));
        id = ious.length;
        iousOf[o.shop].push(id); iousOf[msg.sender].push(id);
        _activate(msg.sender, id, cents);
        emit IouCreated(id, o.shop, msg.sender, o.asset, o.price, uint40(block.timestamp + uint256(o.termDays) * 1 days));
        emit IouAccepted(id);
        if (o.designId != 0 && mints[msg.sender][o.designId].edition == 0) _mint(msg.sender, o.designId);   // the sticker comes with the first loan only
        _usdt(o.shop, msg.sender, o.price);   // state first, then the money: from the shop straight to the borrower
    }

    // =========================================================== IOUs between people
    function createIOU(address debtor, uint8 asset, uint256 amount, uint16 dueDays, string calldata memo) external returns (uint256 id) {
        if (debtor == msg.sender || debtor == address(0)) revert SelfIou();
        if (asset > TOKEN_USDT) revert BadAsset();
        if (amount == 0) revert BadAmount();
        if (dueDays == 0 || dueDays > 30) revert BadDays();
        if (bytes(memo).length > 48) revert BadMemo();
        if (pendingSent[msg.sender] >= MAX_PENDING_SENT) revert TooManyPending();
        _joined(msg.sender); _joined(debtor);          // both sides must be IOU Verified
        (uint256 late_, bool def_) = _overdueCount(msg.sender);
        if (def_ || late_ >= 2) revert Restricted();
        uint32 cents = _toCents(asset, amount);
        if (cents > _limit(levelOf(msg.sender))) revert OverLimit();
        pendingSent[msg.sender]++;
        uint40 due = uint40(block.timestamp + uint256(dueDays) * 1 days);
        ious.push(Iou(msg.sender, debtor, asset, Status.Pending, uint40(block.timestamp), due, 0, cents, 0, amount, memo));
        id = ious.length;
        iousOf[msg.sender].push(id); iousOf[debtor].push(id);
        emit IouCreated(id, msg.sender, debtor, asset, amount, due);
    }
    function acceptIOU(uint256 id) external {
        Iou storage x = _iou(id);
        if (x.debtor != msg.sender) revert NotDebtor();
        if (x.status != Status.Pending) revert WrongStatus();
        if (block.timestamp >= x.dueAt) revert Expired();
        _checkCanBorrow(msg.sender, x.usdCents);
        x.status = Status.Active; pendingSent[x.creditor]--;
        _activate(msg.sender, id, x.usdCents);
        emit IouAccepted(id);
    }
    function declineIOU(uint256 id) external {
        Iou storage x = _iou(id);
        if (x.debtor != msg.sender) revert NotDebtor();
        if (x.status != Status.Pending) revert WrongStatus();
        x.status = Status.Declined; pendingSent[x.creditor]--; emit IouDeclined(id);
    }
    function cancelIOU(uint256 id) external {
        Iou storage x = _iou(id);
        if (x.creditor != msg.sender) revert NotCreditor();
        if (x.status != Status.Pending) revert WrongStatus();
        x.status = Status.Cancelled; pendingSent[msg.sender]--; emit IouCancelled(id);
    }

    /// @notice Repay an IOU in full. Only the debtor can. BNB: send exactly the amount as value. USDT: approve
    ///         this contract for exactly the amount first; it moves from the debtor straight to the creditor.
    function repay(uint256 id) external payable nonReentrant {
        Iou storage x = _iou(id);
        if (x.debtor != msg.sender) revert NotDebtor();
        if (x.status != Status.Active) revert WrongStatus();
        if (msg.value != (x.asset == BNB ? x.amount : 0)) revert WrongAmount();
        // state first
        x.status = Status.Repaid; x.repaidAt = uint40(block.timestamp);
        _settle(x, id);
        if (x.offerId != 0) offers[x.offerId - 1].taken--;   // a repaid shop loan goes back in stock
        // then the money, straight to the creditor
        if (x.asset == BNB) {
            (bool ok, ) = x.creditor.call{value: x.amount, gas: 30000}("");
            if (!ok) credits[x.creditor] += x.amount;
        } else {
            _usdt(msg.sender, x.creditor, x.amount);
        }
        emit IouRepaid(id, msg.sender, x.creditor, x.amount, block.timestamp <= x.dueAt);
    }
    /// @notice Collect BNB that could not be delivered to you when someone repaid.
    function withdraw() external nonReentrant {
        uint256 a = credits[msg.sender];
        if (a == 0) revert NothingToWithdraw();
        credits[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: a}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, a);
    }

    // =========================================================== XP, vouchers, stickers
    function checkIn() external {
        User storage u = _joined(msg.sender);
        uint32 day = uint32(block.timestamp / 1 days);
        if (u.checkDay == day) revert AlreadyCheckedIn();
        // a 7-day card: day after day fills it; a missed day, or a full card, starts again at 1. Day 7 pays 5 + 20 bonus.
        u.checkDays = (u.checkDay + 1 == day && u.checkDays < 7) ? u.checkDays + 1 : 1;
        u.checkDay = day; u.xp += u.checkDays == 7 ? 25 : 5;
        emit CheckedIn(msg.sender, day);
    }
    function claimVoucher(uint8 tier) external {
        User storage u = _joined(msg.sender);
        if (tier > 2) revert BadDesign();
        if (_overdue(msg.sender)) revert Overdue();
        if (u.xp / _step(tier) <= u.claimed[tier]) revert NotEnoughXp();
        u.claimed[tier]++; u.pocket[tier]++;
        emit VoucherClaimed(msg.sender, tier);
    }
    /// @notice Mint one Season 1 sticker with a voucher of its tier. Gas only; no token approval.
    function mintSticker(uint256 designId) external {
        User storage u = _joined(msg.sender);
        if (designId <= FOUNDERS || designId > DESIGNS) revert BadDesign();
        if (_overdue(msg.sender)) revert Overdue();
        if (mints[msg.sender][designId].edition != 0) revert AlreadyHeld();
        uint256 tier = (designId - FOUNDERS - 1) / 3;
        if (u.pocket[tier] == 0) revert NoVoucher();
        u.pocket[tier]--;
        _mint(msg.sender, designId);
    }

    // =========================================================== views
    /// @notice restricted: two or more IOUs past due, or one more than 7 days past due. A restricted account can
    ///         only repay; repaying lifts it at once.
    function getUser(address a) external view returns (User memory u, uint8 level, uint8 score, uint32 limitCents, bool overdue, bool restricted) {
        u = users[a]; level = levelOf(a); score = trustScore(a); limitCents = _limit(level);
        (uint256 n, bool def) = _overdueCount(a); overdue = n != 0; restricted = def || n >= 2;
    }
    function levelOf(address a) public view returns (uint8) {
        User storage u = users[a];
        if (u.joinedAt == 0) return 0;
        (uint256 n, bool def) = _overdueCount(a);
        uint8 base = _level(u);
        if (def || n >= 2) return 1;
        return n == 1 && base > 1 ? base - 1 : base;       // one IOU past due: one level down until it is repaid
    }
    function trustScore(address a) public view returns (uint8) {
        User storage u = users[a];
        if (u.joinedAt == 0) return 0;
        (uint256 n, ) = _overdueCount(a);
        int256 s = 50 + 5 * int256(uint256(u.onTime)) - 10 * int256(uint256(u.late) + n) - 25 * int256(uint256(u.defaults)) + int256(uint256(u.people > 5 ? 10 : u.people * 2));
        return s < 0 ? 0 : s > 100 ? 100 : uint8(uint256(s));
    }
    function claimable(address a) external view returns (uint16[3] memory c) {
        User storage u = users[a];
        for (uint8 t; t < 3; t++) { uint256 n = u.xp / _step(t); c[t] = n > u.claimed[t] ? uint16(n - u.claimed[t]) : 0; }
    }
    function mintInfo(address a, uint256 designId) external view returns (uint32 edition, uint64 blockNo, uint40 time) {
        Mint storage m = mints[a][designId]; return (m.edition, m.blockNo, m.time);
    }
    function getIOU(uint256 id) external view returns (Iou memory) { return _iou(id); }
    function getUserIOUs(address a, uint256 offset, uint256 limit) external view returns (uint256[] memory ids, Iou[] memory list) {
        uint256[] storage all = iousOf[a];
        uint256 n = offset >= all.length ? 0 : (all.length - offset < limit ? all.length - offset : limit);
        ids = new uint256[](n); list = new Iou[](n);
        for (uint256 i; i < n; i++) { ids[i] = all[all.length - 1 - offset - i]; list[i] = ious[ids[i] - 1]; } // newest first
    }
    function getRecentIOUs(uint256 limit) external view returns (uint256[] memory ids, Iou[] memory list) {
        uint256 n = ious.length < limit ? ious.length : limit;
        ids = new uint256[](n); list = new Iou[](n);
        for (uint256 i; i < n; i++) { ids[i] = ious.length - i; list[i] = ious[ids[i] - 1]; }
    }
    function getOffers(uint256 offset, uint256 limit) external view returns (Offer[] memory list) {
        uint256 n = offset >= offers.length ? 0 : (offers.length - offset < limit ? offers.length - offset : limit);
        list = new Offer[](n);
        for (uint256 i; i < n; i++) list[i] = offers[offset + i];
    }
    function getUsers(uint256 offset, uint256 limit) external view returns (address[] memory list) {
        uint256 n = offset >= members.length ? 0 : (members.length - offset < limit ? members.length - offset : limit);
        list = new address[](n);
        for (uint256 i; i < n; i++) list[i] = members[offset + i];
    }
    function stats() external view returns (uint256 memberCount, uint256 iouCount, uint256 onTimeRepays, uint256 active, uint256 stickers, uint256 offerCount) {
        return (members.length, ious.length, repaidOnTime, activeCount, stickersMinted, offers.length);
    }

    // ---- ERC-1155, soulbound
    function balanceOf(address a, uint256 id) public view returns (uint256) { return mints[a][id].edition == 0 ? 0 : 1; }
    function balanceOfBatch(address[] calldata a, uint256[] calldata ids) external view returns (uint256[] memory out) {
        require(a.length == ids.length); out = new uint256[](a.length);
        for (uint256 i; i < a.length; i++) out[i] = balanceOf(a[i], ids[i]);
    }
    function uri(uint256) external view returns (string memory) { return baseUri; }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }
    function setApprovalForAll(address, bool) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256, uint256, bytes calldata) external pure { revert Soulbound(); }
    function safeBatchTransferFrom(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure { revert Soulbound(); }
    function supportsInterface(bytes4 i) external pure returns (bool) { return i == 0x01ffc9a7 || i == 0xd9b67a26 || i == 0x0e89341c; }

    // =========================================================== internals
    function _joined(address a) internal view returns (User storage u) { u = users[a]; if (u.joinedAt == 0) revert NotJoined(); }
    function _iou(uint256 id) internal view returns (Iou storage) { if (id == 0 || id > ious.length) revert WrongStatus(); return ious[id - 1]; }
    function _offer(uint256 id) internal view returns (Offer storage) { if (id == 0 || id > offers.length) revert SoldOut(); return offers[id - 1]; }
    function _step(uint256 tier) internal pure returns (uint256) { return tier == 0 ? 50 : tier == 1 ? 150 : 300; }
    /// @dev USDT from one wallet straight to another, using the approval `from` gave this contract. Nothing stays here.
    function _usdt(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = USDT.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
    function _limit(uint8 level) internal pure returns (uint32) { return level == 3 ? 1000 : level == 2 ? 500 : level == 1 ? 100 : 0; } // cents: $10, $5, $1
    function _level(User storage u) internal view returns (uint8) {
        return (u.good >= 10 && u.defaults == 0 && u.people >= 3) ? 3 : u.good >= 3 ? 2 : 1;
    }
    /// @dev How many of a's active IOUs are past due, and whether any is past the 7-day grace (a default).
    function _overdueCount(address a) internal view returns (uint256 n, bool def) {
        uint256[] storage d = activeDebts[a];
        for (uint256 i; i < d.length; i++) {
            uint256 due = ious[d[i] - 1].dueAt;
            if (block.timestamp > due) { n++; if (block.timestamp > due + GRACE) def = true; }
        }
    }
    function _overdue(address a) internal view returns (bool) { (uint256 n, ) = _overdueCount(a); return n != 0; }
    /// @dev Dollar cents, rounded up, at the moment the IOU is made.
    function _toCents(uint8 asset, uint256 amount) internal view returns (uint32) {
        uint256 c;
        if (asset == TOKEN_USDT) c = (amount + 1e16 - 1) / 1e16;
        else {
            (, int256 p, , uint256 updatedAt, ) = IFeed(BNB_USD_FEED).latestRoundData();
            if (p <= 0 || block.timestamp - updatedAt > PRICE_MAX_AGE) revert StalePrice();
            c = (amount * uint256(p) + 1e24 - 1) / 1e24;
        }
        if (c == 0 || c > 1_000_000) revert BadAmount();
        return uint32(c);
    }
    function _checkCanBorrow(address a, uint32 cents) internal view {
        User storage u = _joined(a);
        if (IAgentId(AGENT_ID).balanceOf(a) == 0) revert NotAgentIdHolder();
        (uint256 n, bool def) = _overdueCount(a);
        if (def || n >= 2) revert Restricted();
        if (activeDebts[a].length >= MAX_ACTIVE_DEBTS) revert TooManyActive();
        if (uint256(u.owedCents) + cents > _limit(levelOf(a))) revert OverLimit();
    }
    function _activate(address debtor, uint256 id, uint32 cents) internal {
        users[debtor].owedCents += cents; activeDebts[debtor].push(id); activeCount++;
    }
    /// @dev The user's record with its per-day counters reset if a new UTC day has begun.
    function _today(address a) internal returns (User storage u) {
        u = users[a]; uint32 day = uint32(block.timestamp / 1 days);
        if (u.xpDay != day) { u.xpDay = day; u.repayXpToday = 0; u.backXpToday = 0; u.takesToday = 0; }
    }
    function _settle(Iou storage x, uint256 id) internal {
        User storage u = users[x.debtor];
        uint256[] storage d = activeDebts[x.debtor];
        for (uint256 i; i < d.length; i++) if (d[i] == id) { d[i] = d[d.length - 1]; d.pop(); break; }
        u.owedCents -= x.usdCents; activeCount--;
        _today(x.debtor);
        uint8 before = _level(u);
        uint32 xp;
        if (block.timestamp <= x.dueAt) {
            u.onTime++; repaidOnTime++;
            if (u.repayXpToday < 3) { u.repayXpToday++; u.good++; xp += 30; /* at most 3 repays a day count toward the level */ if (x.dueAt - block.timestamp >= 1 days) xp += 10; }
            if (u.badges & 2 == 0) { u.badges |= 2; xp += 25; }                      // First Promise
            User storage c = users[x.creditor];
            if (c.joinedAt != 0) {
                _today(x.creditor);
                if (c.backXpToday < 5) { c.backXpToday++; c.xp += 10; }
            }
        } else if (block.timestamp <= uint256(x.dueAt) + GRACE) {
            u.late++; u.good = before == 3 ? 3 : 0;                                  // late: one level down
        } else {
            u.defaults++; u.good = 0;                                                // default: back to L1
        }
        if (!met[x.debtor][x.creditor]) { met[x.debtor][x.creditor] = true; u.people++; if (u.people <= 10) xp += 15; }
        uint8 afterLevel = _level(u);
        if (afterLevel >= 2 && u.badges & 4 == 0) { u.badges |= 4; xp += 125; }      // Trusted: 100 + badge 25
        if (afterLevel == 3 && u.badges & 8 == 0) { u.badges |= 8; xp += 225; }      // Highly Trusted: 200 + badge 25
        u.xp += xp;
    }
    function _mint(address to, uint256 designId) internal {
        uint32 e = ++minted[designId]; stickersMinted++;
        mints[to][designId] = Mint(e, uint64(block.number), uint40(block.timestamp));
        emit TransferSingle(msg.sender, address(0), to, designId, 1);
    }
    /// @dev 2-20 characters: letters, digits, - and _. Brand and staff words are refused.
    function _checkNickname(string calldata s) internal pure {
        bytes calldata b = bytes(s);
        if (b.length < 2 || b.length > 20) revert BadNickname();
        bytes memory low = new bytes(b.length);
        for (uint256 i; i < b.length; i++) {
            bytes1 c = b[i];
            bool okc = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || c == 0x2D || c == 0x5F;
            if (!okc) revert BadNickname();
            low[i] = (c >= 0x41 && c <= 0x5A) ? bytes1(uint8(c) + 32) : c;
        }
        if (_has(low, "binance") || _has(low, "bnb") || _has(low, "official") || _has(low, "admin") || _has(low, "support")) revert BadNickname();
    }
    function _has(bytes memory h, bytes memory n) internal pure returns (bool) {
        if (n.length > h.length) return false;
        for (uint256 i; i <= h.length - n.length; i++) {
            uint256 j;
            while (j < n.length && h[i + j] == n[j]) j++;
            if (j == n.length) return true;
        }
        return false;
    }
}
