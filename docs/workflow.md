# Flujo de trabajo con Git

Proyecto individual (ver [`proposal.md`](../proposal.md)): sin equipo, sin minutas de reunión ni tablero de Jira/tracking formal. El seguimiento real del desarrollo es el historial de commits de `git log`.

En una primera etapa se usó una rama por feature con nombre de tarjeta (`DSW-14`, `DSW-17`) y Pull Request hacia `master` (ver `PR #1` en el historial). En el resto del desarrollo, al ser un solo desarrollador, se trabajó con commits incrementales directo sobre `master`:

```bash
git pull origin master
# ...cambios...
git add <archivos>
git commit -m "descripción de los cambios"
git push origin master
```

Para features más grandes o riesgosas se sigue usando una rama corta (`git checkout -b <nombre>`) que se mergea a `master` una vez probada localmente, para poder revertir fácil si algo sale mal.
