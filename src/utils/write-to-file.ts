import fs from 'fs'

export default function writeToFile(filename: string, content: any) {
  fs.writeFile(filename, JSON.stringify(content), (err: any) => {
    if (err) {
      console.error(err)
    }
    console.log(`${filename} written successfully`)
  })
}
