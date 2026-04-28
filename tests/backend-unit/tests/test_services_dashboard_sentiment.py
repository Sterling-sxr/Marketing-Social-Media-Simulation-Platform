import importlib
import sys
import types


def test_dashboard_service_disables_local_sentiment_by_default(monkeypatch):
    monkeypatch.delenv("ENABLE_LOCAL_SENTIMENT", raising=False)
    sys.modules.pop("apps.core.services.dashboard_service", None)

    fake_torch = types.SimpleNamespace(float32="float32")

    class _FakeTokenizer:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            return object()

    class _FakeModel:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            return object()

    fake_transformers = types.SimpleNamespace(
        AutoTokenizer=_FakeTokenizer,
        AutoModelForSequenceClassification=_FakeModel,
        pipeline=lambda *args, **kwargs: (lambda text: [{"label": "positive"}]),
    )
    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    monkeypatch.setitem(sys.modules, "transformers", fake_transformers)

    dashboard_service = importlib.import_module("apps.core.services.dashboard_service")

    assert dashboard_service._get_sentiment_pipeline() is None
    assert dashboard_service.classify_comment_sentiment("This is great!") == "positive"
