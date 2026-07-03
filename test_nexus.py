import os
import pytest
from unittest.mock import patch, MagicMock
from nexus import _key

@patch("nexus.load_dotenv")
@patch("os.getenv")
def test_key_existing(mock_getenv, mock_load_dotenv):
    mock_getenv.return_value = "secret_value"
    result = _key("MY_KEY")
    mock_load_dotenv.assert_called_once()
    mock_getenv.assert_called_once_with("MY_KEY", "")
    assert result == "secret_value"

@patch("nexus.load_dotenv")
@patch("os.getenv")
def test_key_missing(mock_getenv, mock_load_dotenv):
    mock_getenv.return_value = ""
    result = _key("MISSING_KEY")
    mock_load_dotenv.assert_called_once()
    mock_getenv.assert_called_once_with("MISSING_KEY", "")
    assert result == ""
