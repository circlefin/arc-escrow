// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {RefundProtocol} from "../contracts/escrow_smart_contract/RefundProtocol.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract MockToken is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract FalseReturningToken is IERC20 {
    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function allowance(address, address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract RefundProtocolTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant RECIPIENT_KEY = 0xA11CE;
    address private constant PAYER = address(0x100);
    address private constant REFUND_TO = address(0x300);

    MockToken private token;
    RefundProtocol private protocol;
    address private recipient;

    function setUp() public {
        token = new MockToken();
        protocol = new RefundProtocol(address(this), address(token), "RefundProtocol", "1");
        recipient = vm.addr(RECIPIENT_KEY);

        token.mint(PAYER, 1_000);
        vm.prank(PAYER);
        token.approve(address(protocol), type(uint256).max);
    }

    function testWithdrawnPaymentCannotSubsequentlyBeRefundedByRecipient() public {
        _pay(100);

        uint256[] memory paymentIDs = new uint256[](1);
        paymentIDs[0] = 0;
        vm.prank(recipient);
        protocol.withdraw(paymentIDs);

        // Fund a second payment so an insufficient balance cannot mask the closed-payment check.
        _pay(100);

        vm.expectRevert(abi.encodeWithSelector(RefundProtocol.PaymentFullyWithdrawn.selector, 0));
        vm.prank(recipient);
        protocol.refundByRecipient(0);

        _assertEq(token.balanceOf(REFUND_TO), 0, "refund address received withdrawn funds");
        _assertEq(protocol.balances(recipient), 100, "recipient protocol balance changed");
    }

    function testWithdrawnPaymentCannotSubsequentlyBeRefundedByArbiter() public {
        _pay(100);

        uint256[] memory paymentIDs = new uint256[](1);
        paymentIDs[0] = 0;
        vm.prank(recipient);
        protocol.withdraw(paymentIDs);

        token.mint(address(this), 100);
        token.approve(address(protocol), 100);
        protocol.depositArbiterFunds(100);

        vm.expectRevert(abi.encodeWithSelector(RefundProtocol.PaymentFullyWithdrawn.selector, 0));
        protocol.refundByArbiter(0);

        _assertEq(token.balanceOf(REFUND_TO), 0, "refund address received withdrawn funds");
        _assertEq(protocol.balances(address(this)), 100, "arbiter protocol balance changed");
    }

    function testPartiallyWithdrawnPaymentRefundsOnlyRemainingAmount() public {
        _pay(100);

        uint256[] memory paymentIDs = new uint256[](1);
        paymentIDs[0] = 0;
        uint256[] memory withdrawalAmounts = new uint256[](1);
        withdrawalAmounts[0] = 40;
        uint256 expiry = block.timestamp + 1 days;
        uint256 salt = 1;

        bytes32 digest = protocol.hashEarlyWithdrawalInfo(paymentIDs, withdrawalAmounts, 0, expiry, salt);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(RECIPIENT_KEY, digest);
        protocol.earlyWithdrawByArbiter(paymentIDs, withdrawalAmounts, 0, expiry, salt, recipient, v, r, s);

        vm.prank(recipient);
        protocol.refundByRecipient(0);

        _assertEq(token.balanceOf(recipient), 40, "recipient withdrawal amount");
        _assertEq(token.balanceOf(REFUND_TO), 60, "only unwithdrawn amount should be refunded");
        _assertEq(protocol.balances(recipient), 0, "recipient protocol balance");
    }

    function testSafeTransferFromRejectsFalseReturnValue() public {
        FalseReturningToken falseToken = new FalseReturningToken();
        RefundProtocol falseTokenProtocol =
            new RefundProtocol(address(this), address(falseToken), "RefundProtocol", "1");

        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(falseToken)));
        falseTokenProtocol.pay(recipient, 100, REFUND_TO);
    }

    function _pay(uint256 amount) private {
        vm.prank(PAYER);
        protocol.pay(recipient, amount, REFUND_TO);
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }
}
