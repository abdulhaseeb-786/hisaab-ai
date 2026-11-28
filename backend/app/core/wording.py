"""Small wording helpers so shopkeeper-facing English reads naturally."""


def days(n: int | float) -> str:
    """'1 day', '3 days', '2.5 days'."""
    if isinstance(n, float) and not n.is_integer():
        return f"{n:.1f} days"
    return "1 day" if int(n) == 1 else f"{int(n)} days"
