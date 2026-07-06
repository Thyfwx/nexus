import os
import pytest
from unittest.mock import patch, MagicMock
from nexus import _key

def test_key_existing():
    with patch("os.getenv") as mock_getenv:
        mock_getenv.return_value = "secret_value"
        result = _key("MY_KEY")
        mock_getenv.assert_called_once_with("MY_KEY", "")
        assert result == "secret_value"

def test_key_missing():
    with patch("os.getenv") as mock_getenv:
        mock_getenv.return_value = ""
        result = _key("MISSING_KEY")
        mock_getenv.assert_called_once_with("MISSING_KEY", "")
        assert result == ""
