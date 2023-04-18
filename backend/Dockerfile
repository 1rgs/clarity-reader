

FROM python:3.10-bullseye

ENV POETRY_HOME="/root/.local/bin"
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

COPY pyproject.toml poetry.lock /backend/
WORKDIR /backend

RUN poetry config virtualenvs.in-project true --local
RUN poetry install

CMD  poetry run uvicorn pkg.main:app  --port 8000 --host