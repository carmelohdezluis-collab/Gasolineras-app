from fastapi import FastAPI
import requests

app = FastAPI(title="API de Gasolineras Baratas")

@app.get("/gasolineras/{provincia}")
def obtener_gasolineras(provincia: str, municipio: str = None, limite: int = 5):
    URL = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
    
    try:
        respuesta = requests.get(URL)
        if respuesta.status_code == 200:
            datos = respuesta.json()
            lista_original = datos["ListaEESSPrecio"]
            
            gasolineras_filtradas = []
            
            for g in lista_original:
                # Filtrar Provincia
                if g["Provincia"].upper() == provincia.upper():
                    
                    # Filtrar Municipio (si se solicita)
                    if municipio and g["Municipio"].upper() != municipio.upper():
                        continue
                    
                    precio_str = g["Precio Gasolina 95 E5"].replace(",", ".")
                    if precio_str:
                        try:
                            precio_num = float(precio_str)
                            gasolineras_filtradas.append({
                                "empresa": g["Rótulo"],
                                "direccion": g["Dirección"],
                                "municipio": g["Municipio"],
                                "precio": precio_num
                            })
                        except ValueError:
                            continue
            
            # Ordenar de menor a mayor precio
            gasolineras_ordenadas = sorted(gasolineras_filtradas, key=lambda x: x["precio"])
            
            # Devolvemos el TOP solicitado en formato JSON para la futura App
            return gasolineras_ordenadas[:limite]
            
        return {"error": "No se pudo conectar con el Ministerio"}
    except Exception as e:
        return {"error": str(e)}