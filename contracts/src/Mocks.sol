// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
// Test doubles only. Never deployed for the hackathon.
contract MockAgentId { mapping(address => uint256) public balanceOf; function set(address a, uint256 n) external { balanceOf[a] = n; } }
contract MockFeed { int256 public price = 600e8; uint256 public updatedAt; function set(int256 p, uint256 t) external { price = p; updatedAt = t; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) { return (1, price, 0, updatedAt == 0 ? block.timestamp : updatedAt, 1); } }
contract MockUsdt { mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    function mint(address a, uint256 n) external { balanceOf[a] += n; }
    function approve(address s, uint256 n) external returns (bool) { allowance[msg.sender][s] = n; return true; }
    function transferFrom(address f, address t, uint256 n) external returns (bool) { require(allowance[f][msg.sender] >= n, "allowance"); require(balanceOf[f] >= n, "balance"); allowance[f][msg.sender] -= n; balanceOf[f] -= n; balanceOf[t] += n; return true; } }
contract Rejector { bool public open; function setOpen(bool v) external { open = v; } receive() external payable { require(open, "no"); } function join(address c) external { (bool ok, ) = c.call(abi.encodeWithSignature("join(string)", "rejector")); require(ok); } function create(address c, address debtor, uint256 amt) external returns (uint256) { (bool ok, bytes memory r) = c.call(abi.encodeWithSignature("createIOU(address,uint8,uint256,uint16,string)", debtor, 0, amt, 7, "x")); require(ok); return abi.decode(r, (uint256)); }
    function pull(address c) external { (bool ok, ) = c.call(abi.encodeWithSignature("withdraw()")); require(ok, "withdraw failed"); } }
