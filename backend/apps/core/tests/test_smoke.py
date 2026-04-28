from django.test import SimpleTestCase


class CoreSmokeTests(SimpleTestCase):
    def test_truthy_sanity(self):
        self.assertTrue(True)
