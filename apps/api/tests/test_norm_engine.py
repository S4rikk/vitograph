from apps.api.main import recalculate_flag
from apps.api.services.file_parser import ReferenceRange


def test_recalculate_flag_explicit_bounds():
    # Test explicit low/high
    ref = ReferenceRange(text="", low=10.0, high=20.0)

    assert recalculate_flag(15.0, ref) == "Normal"
    assert recalculate_flag(5.0, ref) == "Low"
    assert recalculate_flag(25.0, ref) == "High"


def test_recalculate_flag_text_less_than():
    # Test "< 15"
    ref = ReferenceRange(text="< 15", low=None, high=None)
    assert recalculate_flag(10.0, ref) == "Normal"
    assert recalculate_flag(20.0, ref) == "High"

    # Test "до 15,5"
    ref_ru = ReferenceRange(text="до 15,5", low=None, high=None)
    assert recalculate_flag(10.0, ref_ru) == "Normal"
    assert recalculate_flag(20.0, ref_ru) == "High"


def test_recalculate_flag_text_greater_than():
    # Test "> 1.5"
    ref = ReferenceRange(text="> 1.5", low=None, high=None)
    assert recalculate_flag(2.0, ref) == "Normal"
    assert recalculate_flag(1.0, ref) == "Low"

    # Test "от 1,5"
    ref_ru = ReferenceRange(text="от 1,5", low=None, high=None)
    assert recalculate_flag(2.0, ref_ru) == "Normal"
    assert recalculate_flag(1.0, ref_ru) == "Low"


def test_recalculate_flag_text_range():
    # Test "10 - 20"
    ref = ReferenceRange(text="10 - 20", low=None, high=None)
    assert recalculate_flag(15.0, ref) == "Normal"
    assert recalculate_flag(5.0, ref) == "Low"
    assert recalculate_flag(25.0, ref) == "High"

    # Test "10,5-20,5"
    ref_comma = ReferenceRange(text="10,5-20,5", low=None, high=None)
    assert recalculate_flag(15.0, ref_comma) == "Normal"
    assert recalculate_flag(10.0, ref_comma) == "Low"
    assert recalculate_flag(25.0, ref_comma) == "High"


def test_recalculate_flag_none_values():
    assert recalculate_flag(None, ReferenceRange(low=10, high=20)) is None
    assert recalculate_flag(15.0, None) is None
    assert recalculate_flag(15.0, ReferenceRange(text="unparseable string")) is None
