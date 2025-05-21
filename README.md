# TurboDev Chrome Extension

<img width="1318" alt="imgs" src="https://github.com/user-attachments/assets/b51e1d7f-5ba1-4fd8-ae08-8823de54038d" />

TurboDev is a Chrome extension that enhances your npm package browsing experience by displaying vulnerability information directly on npmjs.com. It helps developers make informed decisions about package security.

## Features

- Real-time vulnerability scanning when browsing packages on npmjs.com
- Security score rating system (Good, Bad, Best) for package versions
- Detailed vulnerability information display with severity levels
- Modern, clean UI that integrates seamlessly with npmjs.com
- Visual indicators for package security status
- Quick access to vulnerability details through the extension popup
- Support for different versions of the same package
- Cache mechanism to improve performance for frequently viewed packages

## Installation

### Development Mode

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer Mode" by toggling the switch in the top right
4. Click "Load unpacked" and select the folder containing the extension source code
5. The extension should now be installed and active

### From Chrome Web Store (Coming Soon)

Once published, you'll be able to install the extension directly from the Chrome Web Store.

## Usage

1. Visit npmjs.com and browse to any package page
2. The extension will automatically analyze the current package version and display security information
3. Each version in the package version list will be labeled with a security score
4. Click on the extension icon in your browser toolbar to see a detailed summary of vulnerabilities

## Technical Details

TurboDev uses the OSV.dev API to fetch vulnerability information for npm packages. It analyzes the vulnerabilities and assigns a security score based on:

- Number of vulnerabilities
- Severity of vulnerabilities (Critical, High, Medium, Low)
- Impact on the package functionality

## Privacy

TurboDev does not collect any personal information. It only:
- Reads the content of npmjs.com pages to extract package information
- Makes API calls to OSV.dev to fetch vulnerability data
- Stores a small cache of recently viewed packages in your browser's local storage

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

Data provided by [OSV.dev](https://osv.dev/)
