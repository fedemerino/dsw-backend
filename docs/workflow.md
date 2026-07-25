# Flujo de trabajo con Git + Jira

1. Ir a la rama `master`:
   ```
   git checkout master
   ```
2. Asegurarnos de tener los últimos cambios del proyecto

```
   git pull origin master
```

3. Crear una nueva rama con el nombre de la tarjeta de Jira (ejemplo: DSW-14):

```
   git checkout -b DSW-14
```

4. Realizar los cambios necesarios en el código y commitear los cambios

```
   git add .
   git commit -m "descripcion de los cambios"
```

5. Subir la rama al repositorio

```
git push origin DSW-14
```

6. Entrar al repositorio en GitHub y crear un Pull Request desde tu rama (ej: DSW-14) a master.
