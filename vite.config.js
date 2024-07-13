import { defineConfig } from 'vite';
//import path from "path";
export default defineConfig({
  server: {
    open: true
  },
  /* resolve:{
    alias:{
        '@esri/arcgis-rest-places': path.resolve(__dirname, 'node_modules/@esri/arcgis-rest-places/dist/umd/places.umd.min.js'),
    }
  }, */
  build: {
    outDir: 'dist'
  }
});