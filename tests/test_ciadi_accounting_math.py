"""Unit tests for the intended CIADI invoice accounting arithmetic.

These tests are not a PostgreSQL integration test and do not prove the SQL
migration executes successfully. They guard the arithmetic contract while the
migration is being prepared for an isolated Supabase branch.
"""
from decimal import Decimal, ROUND_HALF_UP
import unittest

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_line(quantity: Decimal, unit_price: Decimal, discount: Decimal, tax_rate: Decimal):
    gross = money(quantity * unit_price)
    if quantity <= 0:
        raise ValueError("quantity must be positive")
    if discount < 0 or discount > gross:
        raise ValueError("discount out of range")
    base = money(gross - discount)
    tax = money(base * tax_rate / Decimal("100"))
    total = money(base + tax)
    return {"gross": gross, "discount": discount, "base": base, "tax": tax, "total": total}


def journal_totals(base: Decimal, tax: Decimal, total: Decimal, withholding: Decimal = Decimal("0")):
    if withholding != 0:
        raise ValueError("withholding account rule required")
    if base < 0 or tax < 0 or total <= 0:
        raise ValueError("invalid values")
    if money(base + tax) != money(total):
        raise ValueError("base + tax must equal total")
    return {"debit": money(total), "credit": money(base + tax)}


class AccountingArithmeticTests(unittest.TestCase):
    def test_no_discount_no_tax(self):
        row = calculate_line(Decimal("2"), Decimal("1000"), Decimal("0"), Decimal("0"))
        self.assertEqual(row["base"], Decimal("2000.00"))
        self.assertEqual(row["tax"], Decimal("0.00"))
        self.assertEqual(row["total"], Decimal("2000.00"))
        self.assertEqual(journal_totals(row["base"], row["tax"], row["total"])["debit"],
                         journal_totals(row["base"], row["tax"], row["total"])["credit"])

    def test_discount_applies_before_tax(self):
        row = calculate_line(Decimal("2"), Decimal("1000"), Decimal("200"), Decimal("14"))
        self.assertEqual(row["base"], Decimal("1800.00"))
        self.assertEqual(row["tax"], Decimal("252.00"))
        self.assertEqual(row["total"], Decimal("2052.00"))

    def test_rounding_is_two_decimal_places(self):
        row = calculate_line(Decimal("3"), Decimal("10.005"), Decimal("0"), Decimal("14"))
        self.assertEqual(row["gross"], Decimal("30.02"))
        self.assertEqual(row["tax"], Decimal("4.20"))
        self.assertEqual(row["total"], Decimal("34.22"))

    def test_discount_cannot_exceed_gross(self):
        with self.assertRaises(ValueError):
            calculate_line(Decimal("1"), Decimal("100"), Decimal("101"), Decimal("14"))

    def test_withholding_requires_separate_account_rule(self):
        with self.assertRaisesRegex(ValueError, "withholding"):
            journal_totals(Decimal("100"), Decimal("14"), Decimal("104"), Decimal("10"))

    def test_unbalanced_total_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "base \+ tax"):
            journal_totals(Decimal("100"), Decimal("14"), Decimal("120"))


if __name__ == "__main__":
    unittest.main()
