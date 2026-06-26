export async function chartToImage(chart, width = 1800) {

    const svg = chart.getSVG({

        exporting: {
            sourceWidth: width
        }

    });


    const img = new Image();

    const svgBlob = new Blob( [svg], { type: 'image/svg+xml;charset=utf-8' } );

    const url = URL.createObjectURL(svgBlob);


    return new Promise((resolve) => {

        img.onload = () => {

            const canvas =
                document.createElement('canvas');


            canvas.width =
                img.width;

            canvas.height =
                img.height;


            const ctx =
                canvas.getContext('2d');


            ctx.fillStyle =
                '#ffffff';

            ctx.fillRect( 0, 0, canvas.width,  canvas.height );

            ctx.drawImage(  img,  0, 0  );


            URL.revokeObjectURL(url);


            resolve(
                canvas.toDataURL(  'image/png' )

            );

        };


        img.src = url;

    });

}