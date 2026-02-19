#!/bin/bash

# Recorre todas las carpetas en el directorio actual
for dir in */ ; do
    echo "Procesando carpeta: $dir"
    
    # Busca archivos .zip y .tar* dentro de cada carpeta
    for file in "$dir"*; do
        if [[ -f "$file" ]]; then
            case "$file" in
                *.zip)
                    echo "  Descomprimiendo ZIP: $file"
                    unzip -o "$file" -d "$dir"
                    ;;
                *.tar|*.tar.gz|*.tgz)
                    echo "  Descomprimiendo TAR: $file"
                    tar -xvf "$file" -C "$dir"
                    ;;
                *.rar)
                    echo "  Descomprimiendo RAR: $file"
                    unrar x -o+ "$file" "$dir"
                    ;;
            esac
        fi
    done
done

echo "✅ Todos los archivos han sido descomprimidos."
